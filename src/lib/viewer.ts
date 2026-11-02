import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { sessionPlayer, type SessionPlayer } from "@/server/auth";
import { isAdmin } from "./admin";
import { SESSION_COOKIE } from "./session";

/**
 * The signed-in Linked Player for this request, or null.
 * Reads cookies, so with Cache Components every caller must render inside <Suspense>.
 * Server Actions must call this themselves rather than trust anything from the client.
 */
export const getViewer = cache(async (): Promise<SessionPlayer | null> => {
  // Session expiry compares against the clock, so this must never run during prerendering.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return sessionPlayer(db, token);
});

/**
 * The signed-in Admin for this request, or null. Every Admin page and Server Action checks this itself;
 * the dashboard layout is not a gate.
 */
export const getAdmin = cache(async (): Promise<SessionPlayer | null> => {
  const viewer = await getViewer();
  return viewer && isAdmin(viewer.uuid) ? viewer : null;
});
