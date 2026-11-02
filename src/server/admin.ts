import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or, gt, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { players, reports, reputation, reputationEvents, suspensions } from "@/db/schema";
import { SUSPENSION_REASON_MAX } from "@/lib/admin";
import { normalizeText, type Value } from "@/lib/rules";
import { activeSuspension, totalsFor, type Totals } from "./reputation";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACTIVITY_PAGE_SIZE = 50;

export type PlayerRef = { uuid: string; username: string };

/** A Player's name, falling back to their UUID if the row is missing. Events and Report copies have no foreign keys. */
const nameOf = (username: AnyPgColumn, uuid: SQL) => sql<string>`coalesce(${username}, ${uuid}::text)`;

// ---------------------------------------------------------------------------------------------------------------------
// Overview

export type Overview = {
  openReports: number;
  activeSuspensions: number;
  linkedPlayers: number;
  /** Gives and changes, the same events the daily limit counts. */
  given24h: number;
  given7d: number;
};

export async function overview(db: Db, now = new Date()): Promise<Overview> {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [[open], [suspended], [linked], [given]] = await Promise.all([
    db.select({ n: count() }).from(reports).where(isNull(reports.resolvedAt)),
    db
      .select({ n: sql<number>`count(distinct ${suspensions.playerUuid})`.mapWith(Number) })
      .from(suspensions)
      .where(and(isNull(suspensions.liftedAt), or(isNull(suspensions.until), gt(suspensions.until, now)))),
    db.select({ n: count() }).from(players).where(sql`${players.linkedAt} is not null`),
    db
      .select({
        // Through gte() so the Date is encoded by the column; a bare Date in sql`` reaches postgres-js as a plain string.
        day: sql<number>`count(*) filter (where ${gte(reputationEvents.at, dayAgo)})`.mapWith(Number),
        week: count(),
      })
      .from(reputationEvents)
      .where(and(inArray(reputationEvents.action, ["give", "change"]), gte(reputationEvents.at, weekAgo))),
  ]);
  return {
    openReports: open?.n ?? 0,
    activeSuspensions: suspended?.n ?? 0,
    linkedPlayers: linked?.n ?? 0,
    given24h: given?.day ?? 0,
    given7d: given?.week ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reports

export type ReportRow = {
  id: string;
  category: string;
  details: string | null;
  createdAt: Date;
  reporter: PlayerRef;
  giver: PlayerRef;
  receiver: PlayerRef;
  /** The copy taken when the Report was made. */
  value: Value;
  reason: string | null;
  /** Still the giver's current +1/−1. False once they changed or removed it. */
  current: boolean;
  resolvedAt: Date | null;
  resolution: "dismissed" | "removed" | null;
  resolvedBy: PlayerRef | null;
};

/** Open Reports oldest first, so the queue is worked in order; resolved ones newest first. */
export async function listReports(db: Db, status: "open" | "resolved", limit = 50): Promise<ReportRow[]> {
  const reporter = alias(players, "reporter");
  const giver = alias(players, "giver");
  const receiver = alias(players, "receiver");
  const resolver = alias(players, "resolver");
  const rows = await db
    .select({
      id: reports.id,
      category: reports.category,
      details: reports.details,
      createdAt: reports.createdAt,
      reporterUuid: reports.reporterUuid,
      reporterName: nameOf(reporter.username, sql`${reports.reporterUuid}`),
      giverUuid: reports.giverUuid,
      giverName: nameOf(giver.username, sql`${reports.giverUuid}`),
      receiverUuid: reports.receiverUuid,
      receiverName: nameOf(receiver.username, sql`${reports.receiverUuid}`),
      value: reports.value,
      reason: reports.reason,
      reputationId: reports.reputationId,
      resolvedAt: reports.resolvedAt,
      resolution: reports.resolution,
      resolvedByUuid: reports.resolvedBy,
      resolvedByName: resolver.username,
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.uuid, reports.reporterUuid))
    .leftJoin(giver, eq(giver.uuid, reports.giverUuid))
    .leftJoin(receiver, eq(receiver.uuid, reports.receiverUuid))
    .leftJoin(resolver, eq(resolver.uuid, reports.resolvedBy))
    .where(status === "open" ? isNull(reports.resolvedAt) : sql`${reports.resolvedAt} is not null`)
    .orderBy(status === "open" ? asc(reports.createdAt) : desc(reports.resolvedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    details: r.details,
    createdAt: r.createdAt,
    reporter: { uuid: r.reporterUuid, username: r.reporterName },
    giver: { uuid: r.giverUuid, username: r.giverName },
    receiver: { uuid: r.receiverUuid, username: r.receiverName },
    value: r.value as Value,
    reason: r.reason,
    current: r.reputationId !== null,
    resolvedAt: r.resolvedAt,
    resolution: r.resolution,
    resolvedBy: r.resolvedByUuid ? { uuid: r.resolvedByUuid, username: r.resolvedByName ?? r.resolvedByUuid } : null,
  }));
}

/** Deletes a +1/−1, closes its open Reports as removed and logs `admin_remove`. Its Reply goes with it. */
async function removeAsAdmin(tx: Conn, reputationId: string, adminUuid: string, now: Date): Promise<boolean> {
  const [rep] = await tx.select().from(reputation).where(eq(reputation.id, reputationId));
  if (!rep) return false;
  // Before the delete, which sets the Reports' reputation_id to null.
  await tx
    .update(reports)
    .set({ resolvedAt: now, resolution: "removed", resolvedBy: adminUuid })
    .where(and(eq(reports.reputationId, rep.id), isNull(reports.resolvedAt)));
  await tx.delete(reputation).where(eq(reputation.id, rep.id));
  await tx.insert(reputationEvents).values({
    giverUuid: rep.giverUuid,
    receiverUuid: rep.receiverUuid,
    action: "admin_remove",
    value: rep.value,
    reason: rep.reason,
    at: now,
    adminUuid,
  });
  return true;
}

export type AdminRemoveResult = { ok: true } | { ok: false; error: "not_found" };

/** An Admin removes any +1/−1. Unlike a Player's own removal, it doesn't matter who gave it or whether they are suspended. */
export async function adminRemoveReputation(
  db: Db,
  input: { reputationId: string; adminUuid: string; now?: Date },
): Promise<AdminRemoveResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) =>
    (await removeAsAdmin(tx, input.reputationId, input.adminUuid, now)) ? ({ ok: true } as const) : ({ ok: false, error: "not_found" } as const),
  );
}

export type ResolveResult = { ok: true } | { ok: false; error: "not_found" | "already_resolved" | "gone" };

/**
 * Settles a Report. The decision is about the +1/−1, so it closes every open Report on it, not just this one.
 * `dismiss` keeps the Reputation; `remove` deletes it, which only works while it is still the giver's current one.
 */
export async function resolveReport(
  db: Db,
  input: { reportId: string; adminUuid: string; decision: "dismiss" | "remove"; now?: Date },
): Promise<ResolveResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({ reputationId: reports.reputationId, resolvedAt: reports.resolvedAt })
      .from(reports)
      .where(eq(reports.id, input.reportId));
    if (!report) return { ok: false, error: "not_found" } as const;
    if (report.resolvedAt) return { ok: false, error: "already_resolved" } as const;

    if (input.decision === "remove") {
      if (!report.reputationId || !(await removeAsAdmin(tx, report.reputationId, input.adminUuid, now))) {
        return { ok: false, error: "gone" } as const;
      }
      return { ok: true } as const;
    }

    await tx
      .update(reports)
      .set({ resolvedAt: now, resolution: "dismissed", resolvedBy: input.adminUuid })
      .where(
        and(
          isNull(reports.resolvedAt),
          report.reputationId ? or(eq(reports.id, input.reportId), eq(reports.reputationId, report.reputationId)) : eq(reports.id, input.reportId),
        ),
      );
    return { ok: true } as const;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Players

export type PlayerMatch = { uuid: string; username: string; linkedAt: Date | null };

/**
 * Players the site already knows, by username prefix or exact UUID. Never asks Mojang: Admins only act on Players with a row.
 * An empty query lists the most recently linked Players.
 */
export async function searchPlayers(db: Db, query: string, limit = 20): Promise<PlayerMatch[]> {
  const q = query.trim();
  const select = db.select({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt }).from(players);
  if (!q) {
    return select.where(sql`${players.linkedAt} is not null`).orderBy(desc(players.linkedAt)).limit(limit);
  }
  const hex = q.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) {
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return select.where(eq(players.uuid, uuid)).limit(1);
  }
  // `_` is common in usernames and a LIKE wildcard, so escape it along with `%` and `\`.
  const lower = q.toLowerCase();
  const pattern = `${lower.replace(/[\\%_]/g, "\\$&")}%`;
  return select
    .where(sql`lower(${players.username}) like ${pattern}`)
    .orderBy(sql`lower(${players.username}) = ${lower} desc`, sql`${players.linkedAt} is null`, players.username)
    .limit(limit);
}

export type AdminEntry = {
  id: string;
  value: Value;
  reason: string | null;
  createdAt: Date;
  /** The giver for Reputation received; the receiver for Reputation given. */
  other: PlayerRef;
  openReports: number;
};

export type SuspensionRow = {
  id: number;
  reason: string;
  until: Date | null;
  createdAt: Date;
  liftedAt: Date | null;
  createdBy: PlayerRef | null;
  liftedBy: PlayerRef | null;
  active: boolean;
};

export type PlayerDetail = {
  player: PlayerMatch;
  totals: Totals;
  received: AdminEntry[];
  given: AdminEntry[];
  suspensions: SuspensionRow[];
};

async function entries(db: Db, uuid: string, side: "received" | "given"): Promise<AdminEntry[]> {
  const otherUuid = side === "received" ? reputation.giverUuid : reputation.receiverUuid;
  const openReports = sql<number>`(select count(*) from ${reports} where ${reports.reputationId} = ${reputation.id} and ${reports.resolvedAt} is null)`.mapWith(
    Number,
  );
  const rows = await db
    .select({
      id: reputation.id,
      value: reputation.value,
      reason: reputation.reason,
      createdAt: reputation.createdAt,
      otherUuid: players.uuid,
      otherName: players.username,
      openReports,
    })
    .from(reputation)
    .innerJoin(players, eq(players.uuid, otherUuid))
    .where(eq(side === "received" ? reputation.receiverUuid : reputation.giverUuid, uuid))
    .orderBy(desc(reputation.createdAt));
  return rows.map((r) => ({
    id: r.id,
    value: r.value as Value,
    reason: r.reason,
    createdAt: r.createdAt,
    other: { uuid: r.otherUuid, username: r.otherName },
    openReports: r.openReports,
  }));
}

/** Everything an Admin needs to moderate one Player. Null when the site has no row for them. */
export async function playerDetail(db: Db, uuid: string, now = new Date()): Promise<PlayerDetail | null> {
  const [player] = await db
    .select({ uuid: players.uuid, username: players.username, linkedAt: players.linkedAt })
    .from(players)
    .where(eq(players.uuid, uuid));
  if (!player) return null;

  const creator = alias(players, "creator");
  const lifter = alias(players, "lifter");
  const [totals, received, given, rows] = await Promise.all([
    totalsFor(db, uuid),
    entries(db, uuid, "received"),
    entries(db, uuid, "given"),
    db
      .select({
        id: suspensions.id,
        reason: suspensions.reason,
        until: suspensions.until,
        createdAt: suspensions.createdAt,
        liftedAt: suspensions.liftedAt,
        createdByUuid: suspensions.createdBy,
        createdByName: creator.username,
        liftedByUuid: suspensions.liftedBy,
        liftedByName: lifter.username,
      })
      .from(suspensions)
      .leftJoin(creator, eq(creator.uuid, suspensions.createdBy))
      .leftJoin(lifter, eq(lifter.uuid, suspensions.liftedBy))
      .where(eq(suspensions.playerUuid, uuid))
      .orderBy(desc(suspensions.createdAt)),
  ]);

  const ref = (id: string | null, name: string | null): PlayerRef | null => (id ? { uuid: id, username: name ?? id } : null);
  return {
    player,
    totals,
    received,
    given,
    suspensions: rows.map((s) => ({
      id: s.id,
      reason: s.reason,
      until: s.until,
      createdAt: s.createdAt,
      liftedAt: s.liftedAt,
      createdBy: ref(s.createdByUuid, s.createdByName),
      liftedBy: ref(s.liftedByUuid, s.liftedByName),
      active: !s.liftedAt && (!s.until || s.until > now),
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Suspensions

export type SuspendError = "not_found" | "self" | "reason_required" | "reason_too_long" | "until_past" | "already_suspended";
export type SuspendResult = { ok: true } | { ok: false; error: SuspendError };

/** Stops a Player giving, changing or removing Reputation. `until` null means until an Admin lifts it. */
export async function suspendPlayer(
  db: Db,
  input: { playerUuid: string; adminUuid: string; reason: string; until: Date | null; now?: Date },
): Promise<SuspendResult> {
  const now = input.now ?? new Date();
  if (input.playerUuid === input.adminUuid) return { ok: false, error: "self" };
  const reason = normalizeText(input.reason);
  if (!reason) return { ok: false, error: "reason_required" };
  if (reason.length > SUSPENSION_REASON_MAX) return { ok: false, error: "reason_too_long" };
  if (input.until && input.until <= now) return { ok: false, error: "until_past" };

  return db.transaction(async (tx) => {
    const [player] = await tx.select({ uuid: players.uuid }).from(players).where(eq(players.uuid, input.playerUuid));
    if (!player) return { ok: false, error: "not_found" } as const;
    if (await activeSuspension(tx, input.playerUuid, now)) return { ok: false, error: "already_suspended" } as const;
    await tx.insert(suspensions).values({ playerUuid: input.playerUuid, reason, until: input.until, createdAt: now, createdBy: input.adminUuid });
    return { ok: true } as const;
  });
}

/** Ends a Suspension early. False when it is already lifted or has run out. */
export async function liftSuspension(db: Db, input: { suspensionId: number; adminUuid: string; now?: Date }): Promise<boolean> {
  const now = input.now ?? new Date();
  const lifted = await db
    .update(suspensions)
    .set({ liftedAt: now, liftedBy: input.adminUuid })
    .where(
      and(
        eq(suspensions.id, input.suspensionId),
        isNull(suspensions.liftedAt),
        or(isNull(suspensions.until), gt(suspensions.until, now)),
      ),
    )
    .returning({ id: suspensions.id });
  return lifted.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Activity

export const EVENT_ACTIONS = ["give", "change", "remove", "admin_remove"] as const;
export type EventAction = (typeof EVENT_ACTIONS)[number];

export type ActivityRow = {
  id: number;
  action: EventAction;
  value: Value;
  reason: string | null;
  at: Date;
  giver: PlayerRef;
  receiver: PlayerRef;
  admin: PlayerRef | null;
};

/** The Reputation event log, newest first. Pages by event id: pass the last page's `nextBefore` as `before`. */
export async function activity(
  db: Db,
  filter: { playerUuid?: string; action?: EventAction; before?: number; limit?: number } = {},
): Promise<{ rows: ActivityRow[]; nextBefore: number | null }> {
  const limit = filter.limit ?? ACTIVITY_PAGE_SIZE;
  const giver = alias(players, "giver");
  const receiver = alias(players, "receiver");
  const admin = alias(players, "admin");
  const where = and(
    filter.playerUuid ? or(eq(reputationEvents.giverUuid, filter.playerUuid), eq(reputationEvents.receiverUuid, filter.playerUuid)) : undefined,
    filter.action ? eq(reputationEvents.action, filter.action) : undefined,
    filter.before ? lt(reputationEvents.id, filter.before) : undefined,
  );
  const rows = await db
    .select({
      id: reputationEvents.id,
      action: reputationEvents.action,
      value: reputationEvents.value,
      reason: reputationEvents.reason,
      at: reputationEvents.at,
      giverUuid: reputationEvents.giverUuid,
      giverName: nameOf(giver.username, sql`${reputationEvents.giverUuid}`),
      receiverUuid: reputationEvents.receiverUuid,
      receiverName: nameOf(receiver.username, sql`${reputationEvents.receiverUuid}`),
      adminUuid: reputationEvents.adminUuid,
      adminName: admin.username,
    })
    .from(reputationEvents)
    .leftJoin(giver, eq(giver.uuid, reputationEvents.giverUuid))
    .leftJoin(receiver, eq(receiver.uuid, reputationEvents.receiverUuid))
    .leftJoin(admin, eq(admin.uuid, reputationEvents.adminUuid))
    .where(where)
    .orderBy(desc(reputationEvents.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    rows: page.map((r) => ({
      id: r.id,
      action: r.action,
      value: r.value as Value,
      reason: r.reason,
      at: r.at,
      giver: { uuid: r.giverUuid, username: r.giverName },
      receiver: { uuid: r.receiverUuid, username: r.receiverName },
      admin: r.adminUuid ? { uuid: r.adminUuid, username: r.adminName ?? r.adminUuid } : null,
    })),
    nextBefore: rows.length > limit ? page[page.length - 1].id : null,
  };
}
