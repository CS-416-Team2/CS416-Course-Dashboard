import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Use the edge-safe authConfig only — no DB, no bcrypt, no Node.js-only imports.
// The full auth.ts (with mysql2, bcryptjs, etc.) runs in the Node.js runtime only.
const { auth } = NextAuth(authConfig);

// Next.js 16 requires a named "proxy" export (or default export) from proxy.ts.
export { auth as proxy };

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
