import type { NextAuthConfig } from "next-auth";

const isProduction = process.env.NODE_ENV === "production";

type AuthorizedCallbackArgs = {
  auth: { user?: unknown } | null;
  request: { nextUrl: URL };
};

const authConfig = {
  // Keep middleware/edge config free of DB or Node-only dependencies.
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // Keep the browser session short; refresh-token rotation extends it securely.
    maxAge: 15 * 60,
  },
  trustHost: true,

  // Shared cookie config — must be identical across both the proxy and the full
  // NextAuth instance in auth.ts so they read/write the same cookie.
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-coursehub.session-token" : "coursehub.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }: AuthorizedCallbackArgs) {
      const isAuthenticated = Boolean(auth?.user);

      // DEBUG — remove after diagnosing silent auth failure
      console.log(`[proxy:authorized] path=${nextUrl.pathname} | authenticated=${isAuthenticated} | cookie-name=${isProduction ? "__Secure-coursehub.session-token" : "coursehub.session-token"}`);

      const isAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (!isAuthenticated && isAuthPage) {
        return true;
      }

      if (isAuthenticated && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      console.log(`[proxy:authorized] returning isAuthenticated=${isAuthenticated} for ${nextUrl.pathname}`);
      return isAuthenticated;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
