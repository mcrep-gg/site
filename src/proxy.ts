import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * Pushes the session cookie's expiry forward on every page visit, so active Players never need a new Link Code.
 * The database still decides whether the session is valid; this only stops the browser dropping the cookie.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // GET only: Server Actions (POST) set or delete the cookie themselves, and this mustn't undo a sign-out.
  if (token && request.method === "GET") response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
