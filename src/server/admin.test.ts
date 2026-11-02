import { beforeEach, describe, expect, it } from "vitest";
import { reputationEvents } from "@/db/schema";
import type { Db } from "@/db/client";
import { isAdmin } from "@/lib/admin";
import { addPlayer, testDb } from "@/test/db";
import { createReport, giveReputation, receivedReputation, removeReputation, totalsFor } from "./reputation";
import {
  activity,
  adminRemoveReputation,
  liftSuspension,
  listReports,
  overview,
  playerDetail,
  resolveReport,
  searchPlayers,
  suspendPlayer,
} from "./admin";

const now = new Date("2026-11-10T15:00:00Z");
const longAgo = new Date("2026-01-01T00:00:00Z");

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

/** Alex gives Steve a −1; Reporter and Other both report it. */
async function reportedNegative() {
  const admin = await addPlayer(db, { linkedAt: longAgo });
  const alex = await addPlayer(db, { linkedAt: longAgo });
  const steve = await addPlayer(db, { linkedAt: longAgo });
  const reporter = await addPlayer(db, { linkedAt: longAgo });
  const other = await addPlayer(db, { linkedAt: longAgo });
  await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: -1, reason: "scammed me", now });
  const [entry] = await receivedReputation(db, steve.uuid);
  await createReport(db, { reporterUuid: reporter.uuid, reputationId: entry.id, category: "false" });
  await createReport(db, { reporterUuid: other.uuid, reputationId: entry.id, category: "swap_or_revenge" });
  const open = await listReports(db, "open");
  return { admin, alex, steve, entry, open };
}

describe("isAdmin", () => {
  it("matches listed UUIDs with or without dashes, in any case", () => {
    const list = " 069A79F4-44E9-4726-A5BE-FCA90E38AAF5 ,853c80ef3c3749fdaa49938b674adae6";
    expect(isAdmin("069a79f4-44e9-4726-a5be-fca90e38aaf5", list)).toBe(true);
    expect(isAdmin("853c80ef-3c37-49fd-aa49-938b674adae6", list)).toBe(true);
    expect(isAdmin("00000000-0000-4000-8000-000000000001", list)).toBe(false);
  });

  it("lets nobody in when the list is empty", () => {
    expect(isAdmin("069a79f4-44e9-4726-a5be-fca90e38aaf5", "")).toBe(false);
    expect(isAdmin("", " , ")).toBe(false);
  });
});

describe("resolveReport", () => {
  it("removing deletes the Reputation, closes every open Report on it and logs who did it", async () => {
    const { admin, alex, steve, open } = await reportedNegative();
    expect(open).toHaveLength(2);
    expect(open[0]).toMatchObject({ current: true, value: -1, reason: "scammed me", giver: { uuid: alex.uuid } });

    expect(await resolveReport(db, { reportId: open[0].id, adminUuid: admin.uuid, decision: "remove", now })).toEqual({ ok: true });

    expect(await totalsFor(db, steve.uuid)).toEqual({ positive: 0, negative: 0 });
    expect(await listReports(db, "open")).toHaveLength(0);
    const resolved = await listReports(db, "resolved");
    expect(resolved).toHaveLength(2);
    expect(resolved.every((r) => r.resolution === "removed" && r.resolvedBy?.uuid === admin.uuid && !r.current)).toBe(true);
    const events = await db.select().from(reputationEvents);
    expect(events.at(-1)).toMatchObject({ action: "admin_remove", giverUuid: alex.uuid, adminUuid: admin.uuid });
  });

  it("dismissing keeps the Reputation and closes every open Report on it", async () => {
    const { admin, steve, open } = await reportedNegative();
    expect(await resolveReport(db, { reportId: open[1].id, adminUuid: admin.uuid, decision: "dismiss", now })).toEqual({ ok: true });
    expect(await totalsFor(db, steve.uuid)).toEqual({ positive: 0, negative: 1 });
    expect(await listReports(db, "open")).toHaveLength(0);
    expect((await listReports(db, "resolved")).map((r) => r.resolution)).toEqual(["dismissed", "dismissed"]);
  });

  it("can't remove Reputation the giver already took back, but can still dismiss the Report", async () => {
    const { admin, alex, steve, open } = await reportedNegative();
    await removeReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, now });
    const [report] = await listReports(db, "open");
    expect(report.current).toBe(false);
    expect(await resolveReport(db, { reportId: open[0].id, adminUuid: admin.uuid, decision: "remove", now })).toEqual({
      ok: false,
      error: "gone",
    });
    expect(await resolveReport(db, { reportId: open[0].id, adminUuid: admin.uuid, decision: "dismiss", now })).toEqual({ ok: true });
    // With no Reputation left to tie them together, each Report is settled on its own.
    expect(await listReports(db, "open")).toHaveLength(1);
    expect(await resolveReport(db, { reportId: open[0].id, adminUuid: admin.uuid, decision: "dismiss", now })).toEqual({
      ok: false,
      error: "already_resolved",
    });
  });
});

describe("adminRemoveReputation", () => {
  it("works even when the giver is suspended", async () => {
    const { admin, alex, steve, entry } = await reportedNegative();
    await suspendPlayer(db, { playerUuid: alex.uuid, adminUuid: admin.uuid, reason: "alt accounts", until: null, now });
    expect(await adminRemoveReputation(db, { reputationId: entry.id, adminUuid: admin.uuid, now })).toEqual({ ok: true });
    expect(await totalsFor(db, steve.uuid)).toEqual({ positive: 0, negative: 0 });
    expect(await adminRemoveReputation(db, { reputationId: entry.id, adminUuid: admin.uuid, now })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("suspensions", () => {
  it("stops the Player giving until it is lifted", async () => {
    const admin = await addPlayer(db, { linkedAt: longAgo });
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    expect(await suspendPlayer(db, { playerUuid: alex.uuid, adminUuid: admin.uuid, reason: "  swapping  ", until: null, now })).toEqual({
      ok: true,
    });
    expect(await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now })).toEqual({ ok: false, error: "suspended" });
    expect(await suspendPlayer(db, { playerUuid: alex.uuid, adminUuid: admin.uuid, reason: "again", until: null, now })).toEqual({
      ok: false,
      error: "already_suspended",
    });

    const detail = await playerDetail(db, alex.uuid, now);
    expect(detail?.suspensions).toMatchObject([{ reason: "swapping", active: true, createdBy: { uuid: admin.uuid } }]);
    expect(await liftSuspension(db, { suspensionId: detail!.suspensions[0].id, adminUuid: admin.uuid, now })).toBe(true);
    expect(await liftSuspension(db, { suspensionId: detail!.suspensions[0].id, adminUuid: admin.uuid, now })).toBe(false);
    expect((await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now })).ok).toBe(true);
    expect((await playerDetail(db, alex.uuid, now))?.suspensions[0]).toMatchObject({ active: false, liftedBy: { uuid: admin.uuid } });
  });

  it("needs a reason, a future end and someone other than the Admin", async () => {
    const admin = await addPlayer(db, { linkedAt: longAgo });
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const base = { playerUuid: alex.uuid, adminUuid: admin.uuid, until: null, now };
    expect(await suspendPlayer(db, { ...base, reason: " " })).toEqual({ ok: false, error: "reason_required" });
    expect(await suspendPlayer(db, { ...base, reason: "x".repeat(281) })).toEqual({ ok: false, error: "reason_too_long" });
    expect(await suspendPlayer(db, { ...base, reason: "spam", until: new Date(now.getTime() - 1) })).toEqual({ ok: false, error: "until_past" });
    expect(await suspendPlayer(db, { ...base, playerUuid: admin.uuid, reason: "spam" })).toEqual({ ok: false, error: "self" });
  });
});

describe("overview", () => {
  it("counts open Reports, active Suspensions, Linked Players and recent giving", async () => {
    const { admin, alex } = await reportedNegative();
    await suspendPlayer(db, { playerUuid: alex.uuid, adminUuid: admin.uuid, reason: "spam", until: new Date(now.getTime() + 60_000), now });
    expect(await overview(db, now)).toEqual({ openReports: 2, activeSuspensions: 1, linkedPlayers: 5, given24h: 1, given7d: 1 });
    // The Suspension has run out and the −1 is more than a day old.
    expect(await overview(db, new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000))).toMatchObject({ activeSuspensions: 0, given24h: 0, given7d: 1 });
  });
});

describe("searchPlayers", () => {
  it("finds by username prefix, treating _ literally, or by UUID with or without dashes", async () => {
    const a = await addPlayer(db, { username: "Dream_Fan", linkedAt: longAgo });
    await addPlayer(db, { username: "DreamXFan" });
    expect((await searchPlayers(db, "dream_")).map((p) => p.username)).toEqual(["Dream_Fan"]);
    expect((await searchPlayers(db, "dream")).map((p) => p.username)).toEqual(["Dream_Fan", "DreamXFan"]);
    expect(await searchPlayers(db, a.uuid.replace(/-/g, "").toUpperCase())).toMatchObject([{ uuid: a.uuid }]);
    expect((await searchPlayers(db, "")).map((p) => p.username)).toEqual(["Dream_Fan"]);
  });
});

describe("activity", () => {
  it("lists events newest first, filters by Player and action, and pages by id", async () => {
    const { admin, alex, steve, entry } = await reportedNegative();
    const carol = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: carol.uuid, value: 1, now });
    await adminRemoveReputation(db, { reputationId: entry.id, adminUuid: admin.uuid, now });

    const all = await activity(db);
    expect(all.rows.map((r) => r.action)).toEqual(["admin_remove", "give", "give"]);
    expect(all.rows[0]).toMatchObject({ receiver: { uuid: steve.uuid }, admin: { uuid: admin.uuid } });

    expect((await activity(db, { playerUuid: carol.uuid })).rows).toHaveLength(1);
    expect((await activity(db, { action: "admin_remove" })).rows).toHaveLength(1);

    const first = await activity(db, { limit: 2 });
    expect(first.rows).toHaveLength(2);
    const second = await activity(db, { limit: 2, before: first.nextBefore! });
    expect(second).toMatchObject({ rows: [{ action: "give", receiver: { uuid: steve.uuid } }], nextBefore: null });
  });
});
