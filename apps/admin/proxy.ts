import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "growthos_visitor";
const VISITOR_HEADER = "x-growthos-visitor";

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitor = existing ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(VISITOR_HEADER, visitor);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing) {
    response.cookies.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/"
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)"]
};
