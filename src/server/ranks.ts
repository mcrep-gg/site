import { asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { players } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { rankOf, type Rank, type StoredRank } from "@/lib/ranks";

export type RankedPlayer = {
  uuid: string;
  username: string;
  rank: Rank;
  /** Null for Admins, whose rank comes from ADMIN_UUIDS. */
  setAt: Date | null;
  setBy: { uuid: string; username: string } | null;
};

/**
 * Everyone with a rank, highest rank first, then by name. Admins are listed when the site has a row for them;
 * an Admin's stored rank, if any, is ignored.
 */
export async function listRanked(db: Db, adminList = process.env.ADMIN_UUIDS ?? ""): Promise<RankedPlayer[]> {
  const setter = alias(players, "setter");
  const adminUuids = adminList
    .split(",")
    .map((entry) => entry.replace(/-/g, "").trim().toLowerCase())
    .filter((hex) => /^[0-9a-f]{32}$/.test(hex));
  const rows = await db
    .select({
      uuid: players.uuid,
      username: players.username,
      rank: players.rank,
      setAt: players.rankSetAt,
      setByUuid: players.rankSetBy,
      setByName: setter.username,
    })
    .from(players)
    .leftJoin(setter, eq(setter.uuid, players.rankSetBy))
    .where(adminUuids.length ? or(isNotNull(players.rank), inArray(sql`replace(${players.uuid}::text, '-', '')`, adminUuids)) : isNotNull(players.rank))
    .orderBy(asc(sql`lower(${players.username})`));

  const order: Record<Rank, number> = { admin: 0, staff: 1, pro: 2 };
  return rows
    .map((r): RankedPlayer => {
      const rank = rankOf(r.uuid, r.rank, adminList) as Rank;
      const admin = rank === "admin";
      return {
        uuid: r.uuid,
        username: r.username,
        rank,
        setAt: admin ? null : r.setAt,
        setBy: !admin && r.setByUuid ? { uuid: r.setByUuid, username: r.setByName ?? r.setByUuid } : null,
      };
    })
    .sort((a, b) => order[a.rank] - order[b.rank]);
}

export type SetRankError = "not_found" | "is_admin" | "unchanged";
export type SetRankResult = { ok: true } | { ok: false; error: SetRankError };

/** An Admin gives a Player Staff or Pro, or takes their rank away with `rank: null`. Admin can't be given or taken here. */
export async function setRank(
  db: Db,
  input: { playerUuid: string; adminUuid: string; rank: StoredRank | null; now?: Date; adminList?: string },
): Promise<SetRankResult> {
  if (isAdmin(input.playerUuid, input.adminList)) return { ok: false, error: "is_admin" };
  const [player] = await db.select({ rank: players.rank }).from(players).where(eq(players.uuid, input.playerUuid));
  if (!player) return { ok: false, error: "not_found" };
  if (player.rank === input.rank) return { ok: false, error: "unchanged" };
  await db
    .update(players)
    .set({ rank: input.rank, rankSetAt: input.now ?? new Date(), rankSetBy: input.adminUuid })
    .where(eq(players.uuid, input.playerUuid));
  return { ok: true };
}
