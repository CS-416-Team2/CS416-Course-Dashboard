import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "coursehub.session-token";

const protectedPrefixes = ["/dashboard", "/courses", "/students", "/assignments", "/grading"];

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix),
  );

  if (!hasSession && isProtectedRoute) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/courses/:path*",
    "/students/:path*",
    "/assignments/:path*",
    "/grading/:path*",
  ],
};
