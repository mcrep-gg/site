import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players } from "@/db/schema";

/** Java Edition usernames. Some very old accounts are shorter than 3 characters. */
export const USERNAME_RE = /^[A-Za-z0-9_]{1,16}$/;

const REFRESH_MS = 24 * 60 * 60 * 1000;

export type Player = { uuid: string; username: string; linkedAt: Date | null };

/** Mojang returns UUIDs without dashes; we store them dashed and lowercase. */
export function dashUuid(raw: string): string {
  const h = raw.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) throw new Error(`Not a UUID: ${raw}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type MojangLookup = (username: string) => Promise<{ uuid: string; username: string } | null>;

/** Looks a username up with Mojang. Returns null when no Java Edition account has that name. */
export const mojangLookup: MojangLookup = async (username) => {
  const urls = [
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(username)}`,
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (res.status === 404 || res.status === 204) return null;
      if (!res.ok) throw new Error(`Mojang lookup failed: ${res.status}`);
      const body = (await res.json()) as { id: string; name: string };
      return { uuid: dashUuid(body.id), username: body.name };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
};

export async function getPlayer(db: Db, uuid: string): Promise<Player | null> {
  const [row] = await db
    .select({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt })
    .from(players)
    .where(eq(players.uuid, uuid));
  return row ?? null;
}

/**
 * Finds a Player by username, asking Mojang when we have not seen the name in the last day.
 * Any Java Edition account can be looked up and receive Reputation, even if it never linked.
 */
export async function findPlayerByName(db: Db, username: string, lookup: MojangLookup = mojangLookup, now = new Date()): Promise<Player | null> {
  if (!USERNAME_RE.test(username)) return null;
  const [local] = await db
    .select({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt, refreshedAt: players.refreshedAt })
    .from(players)
    .where(sql`lower(${players.username}) = ${username.toLowerCase()}`)
    .orderBy(sql`${players.refreshedAt} desc`)
    .limit(1);
  if (local && now.getTime() - local.refreshedAt.getTime() < REFRESH_MS) {
    return { uuid: local.uuid, username: local.username, linkedAt: local.linkedAt };
  }

  const found = await lookup(username);
  if (!found) return null;
  const [row] = await db
    .insert(players)
    .values({ uuid: found.uuid, username: found.username, refreshedAt: now })
    .onConflictDoUpdate({ target: players.uuid, set: { username: found.username, refreshedAt: now } })
    .returning({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt });
  return row;
}
