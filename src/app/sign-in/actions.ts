"use server";

import { cookies } from "next/headers";
import { db } from "@/db";
import { endSession, redeemLinkCode } from "@/server/auth";
import { getPlayer } from "@/server/players";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export type SignInState =
  | { status: "idle" }
  | { status: "error"; error: "invalid" | "expired" | "used"; code: string }
  | { status: "success"; uuid: string; username: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const code = String(formData.get("code") ?? "");
  const result = await redeemLinkCode(db, code);
  if (!result.ok) return { status: "error", error: result.error, code };

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  const player = await getPlayer(db, result.playerUuid);
  return { status: "success", uuid: result.playerUuid, username: player?.username ?? "" };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await endSession(db, token);
  jar.delete(SESSION_COOKIE);
}
