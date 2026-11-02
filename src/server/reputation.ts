import { and, count, desc, eq, gte, inArray, isNull, or, gt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players, replies, reports, reputation, reputationEvents, suspensions } from "@/db/schema";
import {
  dailyLimit,
  decideGive,
  newPlayerDaysLeft,
  nextUtcReset,
  normalizeText,
  startOfUtcDay,
  validateReply,
  validateReport,
  type GiveDecision,
  type ReplyError,
  type ReportError,
  type Value,
} from "@/lib/rules";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

export type ActiveSuspension = { reason: string; until: Date | null };

export async function activeSuspension(conn: Conn, playerUuid: string, now: Date): Promise<ActiveSuspension | null> {
  const [row] = await conn
    .select({ reason: suspensions.reason, until: suspensions.until })
    .from(suspensions)
    .where(
      and(
        eq(suspensions.playerUuid, playerUuid),
        isNull(suspensions.liftedAt),
        or(isNull(suspensions.until), gt(suspensions.until, now)),
      ),
    )
    .orderBy(desc(suspensions.createdAt))
    .limit(1);
  return row ?? null;
}

async function usedToday(conn: Conn, giverUuid: string, now: Date): Promise<number> {
  const [row] = await conn
    .select({ n: count() })
    .from(reputationEvents)
    .where(
      and(
        eq(reputationEvents.giverUuid, giverUuid),
        inArray(reputationEvents.action, ["give", "change"]),
        gte(reputationEvents.at, startOfUtcDay(now)),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Gives or changes the giver's +1/-1 on the receiver. A change replaces the old one outright:
 * its Reply goes with it, and Reports keep their own copy.
 */
export async function giveReputation(
  db: Db,
  input: { giverUuid: string; receiverUuid: string; value: Value; reason?: string | null; now?: Date },
): Promise<GiveDecision> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [giver] = await tx.select({ linkedAt: players.linkedAt }).from(players).where(eq(players.uuid, input.giverUuid));
    const [existing] = await tx
      .select({ id: reputation.id, value: reputation.value, reason: reputation.reason })
      .from(reputation)
      .where(and(eq(reputation.giverUuid, input.giverUuid), eq(reputation.receiverUuid, input.receiverUuid)));

    const decision = decideGive({
      giverUuid: input.giverUuid,
      receiverUuid: input.receiverUuid,
      value: input.value,
      reason: input.reason,
      giverLinkedAt: giver?.linkedAt ?? null,
      giverSuspended: !!(await activeSuspension(tx, input.giverUuid, now)),
      usedToday: await usedToday(tx, input.giverUuid, now),
      existing: existing ? { value: existing.value as Value, reason: existing.reason } : null,
      now,
    });
    if (!decision.ok || decision.kind === "unchanged") return decision;

    if (existing) await tx.delete(reputation).where(eq(reputation.id, existing.id));
    await tx.insert(reputation).values({
      giverUuid: input.giverUuid,
      receiverUuid: input.receiverUuid,
      value: input.value,
      reason: decision.reason,
      createdAt: now,
    });
    await tx.insert(reputationEvents).values({
      giverUuid: input.giverUuid,
      receiverUuid: input.receiverUuid,
      action: decision.kind,
      value: input.value,
      reason: decision.reason,
      at: now,
    });
    return decision;
  });
}

export type RemoveResult = { ok: true } | { ok: false; error: "not_found" | "suspended" };

/** Takes back the giver's +1/-1. Never counts toward the daily limit. */
export async function removeReputation(
  db: Db,
  input: { giverUuid: string; receiverUuid: string; now?: Date },
): Promise<RemoveResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    if (await activeSuspension(tx, input.giverUuid, now)) return { ok: false, error: "suspended" } as const;
    const [removed] = await tx
      .delete(reputation)
      .where(and(eq(reputation.giverUuid, input.giverUuid), eq(reputation.receiverUuid, input.receiverUuid)))
      .returning({ value: reputation.value, reason: reputation.reason });
    if (!removed) return { ok: false, error: "not_found" } as const;
    await tx.insert(reputationEvents).values({
      giverUuid: input.giverUuid,
      receiverUuid: input.receiverUuid,
      action: "remove",
      value: removed.value,
      reason: removed.reason,
      at: now,
    });
    return { ok: true } as const;
  });
}

export type Totals = { positive: number; negative: number };

export async function totalsFor(db: Db, receiverUuid: string): Promise<Totals> {
  const [row] = await db
    .select({
      positive: sql<number>`count(*) filter (where ${reputation.value} = 1)`.mapWith(Number),
      negative: sql<number>`count(*) filter (where ${reputation.value} = -1)`.mapWith(Number),
    })
    .from(reputation)
    .where(eq(reputation.receiverUuid, receiverUuid));
  return { positive: row?.positive ?? 0, negative: row?.negative ?? 0 };
}

export type ReceivedEntry = {
  id: string;
  value: Value;
  reason: string | null;
  createdAt: Date;
  giver: { uuid: string; username: string };
  reply: { text: string; updatedAt: Date } | null;
};

/** Every +1/-1 a Player has received, newest first. */
export async function receivedReputation(db: Db, receiverUuid: string): Promise<ReceivedEntry[]> {
  const rows = await db
    .select({
      id: reputation.id,
      value: reputation.value,
      reason: reputation.reason,
      createdAt: reputation.createdAt,
      giverUuid: players.uuid,
      giverName: players.username,
      replyText: replies.text,
      replyUpdatedAt: replies.updatedAt,
    })
    .from(reputation)
    .innerJoin(players, eq(players.uuid, reputation.giverUuid))
    .leftJoin(replies, eq(replies.reputationId, reputation.id))
    .where(eq(reputation.receiverUuid, receiverUuid))
    .orderBy(desc(reputation.createdAt));
  return rows.map((r) => ({
    id: r.id,
    value: r.value as Value,
    reason: r.reason,
    createdAt: r.createdAt,
    giver: { uuid: r.giverUuid, username: r.giverName },
    reply: r.replyText != null && r.replyUpdatedAt ? { text: r.replyText, updatedAt: r.replyUpdatedAt } : null,
  }));
}

export type GiverStatus = {
  /** The viewer's current +1/-1 on the target, if any. */
  existing: { value: Value; reason: string | null; createdAt: Date } | null;
  usedToday: number;
  limit: number;
  /** Days until the new-Player limit lifts; 0 when the full limit applies. */
  newPlayerDaysLeft: number;
  resetsAt: Date;
  suspension: ActiveSuspension | null;
};

/** What a Linked Player viewing someone's profile needs to know before giving Reputation. */
export async function giverStatus(db: Db, viewer: { uuid: string; linkedAt: Date }, targetUuid: string, now = new Date()): Promise<GiverStatus> {
  const [existing] = await db
    .select({ value: reputation.value, reason: reputation.reason, createdAt: reputation.createdAt })
    .from(reputation)
    .where(and(eq(reputation.giverUuid, viewer.uuid), eq(reputation.receiverUuid, targetUuid)));
  return {
    existing: existing ? { ...existing, value: existing.value as Value } : null,
    usedToday: await usedToday(db, viewer.uuid, now),
    limit: dailyLimit(viewer.linkedAt, now),
    newPlayerDaysLeft: newPlayerDaysLeft(viewer.linkedAt, now),
    resetsAt: nextUtcReset(now),
    suspension: await activeSuspension(db, viewer.uuid, now),
  };
}

export type ReplyResult = { ok: true } | { ok: false; error: ReplyError | "not_found" };

/** Creates or edits the viewer's one Reply on a +1/-1 they received. */
export async function saveReply(db: Db, input: { viewerUuid: string; reputationId: string; text: string; now?: Date }): Promise<ReplyResult> {
  const now = input.now ?? new Date();
  const [rep] = await db.select({ receiverUuid: reputation.receiverUuid }).from(reputation).where(eq(reputation.id, input.reputationId));
  if (!rep) return { ok: false, error: "not_found" };
  const error = validateReply(input.text, input.viewerUuid, rep.receiverUuid);
  if (error) return { ok: false, error };
  const text = input.text.trim();
  await db
    .insert(replies)
    .values({ reputationId: input.reputationId, text, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: replies.reputationId, set: { text, updatedAt: now } });
  return { ok: true };
}

export async function deleteReply(db: Db, input: { viewerUuid: string; reputationId: string }): Promise<boolean> {
  const [rep] = await db.select({ receiverUuid: reputation.receiverUuid }).from(reputation).where(eq(reputation.id, input.reputationId));
  if (!rep || rep.receiverUuid !== input.viewerUuid) return false;
  await db.delete(replies).where(eq(replies.reputationId, input.reputationId));
  return true;
}

export type ReportResult = { ok: true } | { ok: false; error: ReportError | "not_found" | "already_reported" | "not_linked" };

/** Asks an Admin to review a +1/-1. Each Linked Player can report each one once. */
export async function createReport(
  db: Db,
  input: { reporterUuid: string; reputationId: string; category: string; details?: string | null },
): Promise<ReportResult> {
  const [reporter] = await db.select({ linkedAt: players.linkedAt }).from(players).where(eq(players.uuid, input.reporterUuid));
  if (!reporter?.linkedAt) return { ok: false, error: "not_linked" };
  const error = validateReport(input.category, input.details);
  if (error) return { ok: false, error };
  const [rep] = await db.select().from(reputation).where(eq(reputation.id, input.reputationId));
  if (!rep) return { ok: false, error: "not_found" };
  const inserted = await db
    .insert(reports)
    .values({
      reputationId: rep.id,
      reporterUuid: input.reporterUuid,
      category: input.category,
      details: normalizeText(input.details),
      giverUuid: rep.giverUuid,
      receiverUuid: rep.receiverUuid,
      value: rep.value,
      reason: rep.reason,
    })
    .onConflictDoNothing()
    .returning({ id: reports.id });
  return inserted.length ? { ok: true } : { ok: false, error: "already_reported" };
}

export async function hasReported(db: Db, reporterUuid: string, reputationIds: string[]): Promise<Set<string>> {
  if (!reputationIds.length) return new Set();
  const rows = await db
    .select({ id: reports.reputationId })
    .from(reports)
    .where(and(eq(reports.reporterUuid, reporterUuid), inArray(reports.reputationId, reputationIds)));
  return new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
}

/** Players need Reputation from at least this many Players to be listed. */
export const LEADERBOARD_MIN_GIVERS = 10;

export type LeaderboardRow = { uuid: string; username: string; positive: number; negative: number; net: number };

export async function leaderboard(db: Db, order: "highest" | "lowest", limit = 25): Promise<LeaderboardRow[]> {
  const positive = sql<number>`count(*) filter (where ${reputation.value} = 1)`.mapWith(Number);
  const negative = sql<number>`count(*) filter (where ${reputation.value} = -1)`.mapWith(Number);
  const net = sql<number>`sum(${reputation.value})`.mapWith(Number);
  return db
    .select({ uuid: players.uuid, username: players.username, positive, negative, net })
    .from(reputation)
    .innerJoin(players, eq(players.uuid, reputation.receiverUuid))
    .groupBy(players.uuid, players.username)
    .having(sql`count(*) >= ${LEADERBOARD_MIN_GIVERS}`)
    .orderBy(order === "highest" ? sql`sum(${reputation.value}) desc` : sql`sum(${reputation.value}) asc`, players.username)
    .limit(limit);
}
