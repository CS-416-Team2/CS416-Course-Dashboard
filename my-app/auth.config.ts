import type { NextAuthConfig } from "next-auth";

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
  callbacks: {
    authorized({ auth, request: { nextUrl } }: AuthorizedCallbackArgs) {
      const isAuthenticated = Boolean(auth?.user);
      const isAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (!isAuthenticated && isAuthPage) {
        return true;
      }

      if (isAuthenticated && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return isAuthenticated;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
