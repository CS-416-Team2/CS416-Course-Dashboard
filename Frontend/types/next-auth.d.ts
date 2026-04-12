import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      sessionVersion: number;
    } & DefaultSession["user"];
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    accessTokenExpiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}
