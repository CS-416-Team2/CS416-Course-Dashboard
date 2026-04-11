type AuthorizedCallbackArgs = {
  auth: { user?: unknown } | null;
  request: { nextUrl: URL };
};

const authConfig = {
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
      const isAuthPage = nextUrl.pathname === "/login";

      if (!isAuthenticated && isAuthPage) {
        return true;
      }

      if (isAuthenticated && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return isAuthenticated;
    },
  },
} as const;

export default authConfig;
