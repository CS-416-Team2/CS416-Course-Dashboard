import { NextResponse } from "next/server";
import { auth } from "@/auth";

const protectedPrefixes = ["/dashboard", "/courses", "/students", "/assignments", "/grading"];

export default auth((request) => {
  const { nextUrl } = request;
  const isAuthenticated = Boolean(request.auth?.user);
  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix),
  );

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

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
