import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { linkCodes, players, sessions } from "@/db/schema";
import { SESSION_TTL_MS } from "@/lib/session";

export const LINK_CODE_TTL_MS = 5 * 60 * 1000;
// A session used again within a day of its last renewal isn't written to, so page views don't all hit the database.
const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

// No 0/O, 1/I/L: codes are read off a Minecraft chat line and typed by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Upserts the Player and issues a fresh single-use Link Code for them. Only the Link Server calls this. */
export async function issueLinkCode(db: Db, player: { uuid: string; username: string }, now = new Date()) {
  await db
    .insert(players)
    .values({ uuid: player.uuid, username: player.username, refreshedAt: now })
    .onConflictDoUpdate({ target: players.uuid, set: { username: player.username, refreshedAt: now } });

  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
  for (;;) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const inserted = await db
      .insert(linkCodes)
      .values({ codeHash: sha256(code), playerUuid: player.uuid, createdAt: now, expiresAt })
      .onConflictDoNothing()
      .returning({ codeHash: linkCodes.codeHash });
    if (inserted.length) return { code, expiresAt };
  }
}

export type RedeemResult =
  | { ok: true; playerUuid: string; token: string; expiresAt: Date }
  | { ok: false; error: "invalid" | "expired" | "used" };

/**
 * Redeems a Link Code and opens a session that lasts while the Player keeps visiting. Every other session for the Player is signed out,
 * because whoever holds a fresh code is the account's current owner.
 */
export async function redeemLinkCode(db: Db, rawCode: string, now = new Date()): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LENGTH) return { ok: false, error: "invalid" };

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(linkCodes).where(eq(linkCodes.codeHash, sha256(code)));
    if (!row) return { ok: false, error: "invalid" } as const;
    if (row.usedAt) return { ok: false, error: "used" } as const;
    if (row.expiresAt <= now) return { ok: false, error: "expired" } as const;

    const claimed = await tx
      .update(linkCodes)
      .set({ usedAt: now })
      .where(and(eq(linkCodes.codeHash, row.codeHash), isNull(linkCodes.usedAt)))
      .returning({ codeHash: linkCodes.codeHash });
    if (!claimed.length) return { ok: false, error: "used" } as const;

    await tx
      .update(players)
      .set({ linkedAt: now })
      .where(and(eq(players.uuid, row.playerUuid), isNull(players.linkedAt)));

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await tx.delete(sessions).where(eq(sessions.playerUuid, row.playerUuid));
    await tx.insert(sessions).values({ tokenHash: sha256(token), playerUuid: row.playerUuid, createdAt: now, expiresAt });
    return { ok: true, playerUuid: row.playerUuid, token, expiresAt } as const;
  });
}

export type SessionPlayer = { uuid: string; username: string; linkedAt: Date };

/** The Player a session token belongs to, or null. Using a session pushes its expiry forward. */
export async function sessionPlayer(db: Db, token: string, now = new Date()): Promise<SessionPlayer | null> {
  const tokenHash = sha256(token);
  const [row] = await db
    .select({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(players, eq(players.uuid, sessions.playerUuid))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));
  if (!row?.linkedAt) return null;
  if (row.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS - SESSION_RENEW_AFTER_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  return { uuid: row.uuid, username: row.username, linkedAt: row.linkedAt };
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}
