import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { timingSafeDelay } from "@/lib/auth/crypto";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "@/lib/auth/refresh-tokens";
import { credentialsSchema, findUserByEmail, getUserSessionMeta } from "@/lib/auth/users";
import { env } from "@/lib/env";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const DUMMY_BCRYPT_HASH =
  "$2b$12$SbC38gGyGpsiyk/Qy9iLeOiYgdp5PUvz21iyMNoQdIVH8dH../TeW";
const isProduction = process.env.NODE_ENV === "production";
const useSecureCookies = env.AUTH_COOKIE_SECURE
  ? env.AUTH_COOKIE_SECURE === "true"
  : isProduction;

type AuthorizedUser = {
  id: string;
  email: string;
  name: string;
  sessionVersion: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const startedAt = Date.now();
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          console.warn("[auth] credential schema validation failed:", parsed.error.flatten().fieldErrors);
          await timingSafeDelay(startedAt);
          return null;
        }

        const { email, password } = parsed.data;

        let user: Awaited<ReturnType<typeof findUserByEmail>>;
        try {
          user = await findUserByEmail(email);
        } catch (err) {
          console.error("[auth] DB lookup failed:", err);
          await timingSafeDelay(startedAt);
          return null;
        }

        const passwordHash = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
        const passwordValid = await bcrypt.compare(password, passwordHash);

        await timingSafeDelay(startedAt);

        if (!user || !passwordValid || !user.isActive) {
          console.warn("[auth] login rejected:", { userFound: !!user, passwordValid, isActive: user?.isActive });
          return null;
        }

        const { token, expiresAt } = await issueRefreshToken(user.userId);
        return {
          id: String(user.userId),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          sessionVersion: user.sessionVersion,
          refreshToken: token,
          refreshTokenExpiresAt: expiresAt.getTime(),
        } satisfies AuthorizedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as AuthorizedUser;
        token.sub = authenticatedUser.id;
        token.email = authenticatedUser.email;
        token.name = authenticatedUser.name;
        token.sessionVersion = authenticatedUser.sessionVersion;
        token.refreshToken = authenticatedUser.refreshToken;
        token.refreshTokenExpiresAt = authenticatedUser.refreshTokenExpiresAt;
        token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
        token.error = undefined;
        return token;
      }

      const accessExpiresAt =
        typeof token.accessTokenExpiresAt === "number" ? token.accessTokenExpiresAt : 0;
      if (Date.now() < accessExpiresAt) {
        return token;
      }

      if (typeof token.refreshToken !== "string") {
        token.error = "RefreshAccessTokenError";
        return token;
      }

      const rotated = await rotateRefreshToken(token.refreshToken);
      if (!rotated) {
        token.error = "RefreshAccessTokenError";
        return token;
      }

      const sessionMeta = await getUserSessionMeta(rotated.userId);
      if (!sessionMeta?.isActive) {
        token.error = "RefreshAccessTokenError";
        return token;
      }

      token.sub = String(rotated.userId);
      token.sessionVersion = sessionMeta.sessionVersion;
      token.refreshToken = rotated.newToken;
      token.refreshTokenExpiresAt = rotated.newExpiresAt.getTime();
      token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
      token.error = undefined;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      }
      session.error =
        token.error === "RefreshAccessTokenError" ? "RefreshAccessTokenError" : undefined;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (
        "token" in message &&
        message.token?.refreshToken &&
        typeof message.token.refreshToken === "string"
      ) {
        await revokeRefreshToken(message.token.refreshToken);
      }
    },
  },
  jwt: {
    maxAge: 15 * 60,
  },
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-coursehub.session-token" : "coursehub.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
});
