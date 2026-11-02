export const SESSION_COOKIE = "mcrep_session";

/** A session ends after this long without a visit. Each visit starts the clock again. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Cookie settings shared by sign-in and the Proxy that keeps the cookie alive. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
