import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "growthos_visitor";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
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
