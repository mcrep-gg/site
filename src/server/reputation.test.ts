import { beforeEach, describe, expect, it } from "vitest";
import { reputationEvents, suspensions } from "@/db/schema";
import type { Db } from "@/db/client";
import { addPlayer, testDb } from "@/test/db";
import {
  createReport,
  giveReputation,
  giverStatus,
  leaderboard,
  receivedReputation,
  removeReputation,
  saveReply,
  totalsFor,
} from "./reputation";

const now = new Date("2026-11-10T15:00:00Z");
const longAgo = new Date("2026-01-01T00:00:00Z");

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

describe("giveReputation", () => {
  it("records a +1 and counts it in the totals", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    const result = await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now });
    expect(result).toMatchObject({ ok: true, kind: "give" });
    expect(await totalsFor(db, steve.uuid)).toEqual({ positive: 1, negative: 0 });
  });

  it("replaces the old +1 with a -1 instead of adding a second one", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now });
    const change = await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: -1, reason: "scammed me", now });
    expect(change).toMatchObject({ ok: true, kind: "change" });
    expect(await totalsFor(db, steve.uuid)).toEqual({ positive: 0, negative: 1 });
    expect(await db.select().from(reputationEvents)).toHaveLength(2);
  });

  it("drops the Reply when the Reputation it answered is changed", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: -1, reason: "rude", now });
    const [entry] = await receivedReputation(db, steve.uuid);
    expect(await saveReply(db, { viewerUuid: steve.uuid, reputationId: entry.id, text: "It was a joke" })).toEqual({ ok: true });
    expect((await receivedReputation(db, steve.uuid))[0].reply?.text).toBe("It was a joke");

    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now });
    expect((await receivedReputation(db, steve.uuid))[0].reply).toBeNull();
  });

  it("stops at the daily limit, but removing still works and costs nothing", async () => {
    const alex = await addPlayer(db, { linkedAt: new Date(now.getTime() - 60_000) });
    const targets = await Promise.all([1, 2, 3, 4].map(() => addPlayer(db)));
    for (const t of targets.slice(0, 3)) {
      expect((await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: t.uuid, value: 1, now })).ok).toBe(true);
    }
    expect(await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: targets[3].uuid, value: 1, now })).toEqual({
      ok: false,
      error: "limit_reached",
    });
    expect(await removeReputation(db, { giverUuid: alex.uuid, receiverUuid: targets[0].uuid, now })).toEqual({ ok: true });
    const status = await giverStatus(db, { uuid: alex.uuid, linkedAt: new Date(now.getTime() - 60_000) }, targets[3].uuid, now);
    expect(status).toMatchObject({ usedToday: 3, limit: 3, newPlayerDaysLeft: 7 });

    const tomorrow = new Date("2026-11-11T00:00:01Z");
    expect((await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: targets[3].uuid, value: 1, now: tomorrow })).ok).toBe(true);
  });

  it("blocks suspended Players from giving and removing", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now });
    await db.insert(suspensions).values({ playerUuid: alex.uuid, reason: "alt ring", until: new Date("2026-12-01T00:00:00Z") });
    expect(await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: -1, reason: "x", now })).toEqual({
      ok: false,
      error: "suspended",
    });
    expect(await removeReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, now })).toEqual({ ok: false, error: "suspended" });
  });
});

describe("saveReply", () => {
  it("only lets the receiver reply", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now });
    const [entry] = await receivedReputation(db, steve.uuid);
    expect(await saveReply(db, { viewerUuid: alex.uuid, reputationId: entry.id, text: "hi" })).toEqual({ ok: false, error: "not_receiver" });
  });
});

describe("createReport", () => {
  it("lets each Linked Player report a +1/-1 once", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db, { linkedAt: longAgo });
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: -1, reason: "lies", now });
    const [entry] = await receivedReputation(db, steve.uuid);
    const report = { reporterUuid: steve.uuid, reputationId: entry.id, category: "false" };
    expect(await createReport(db, report)).toEqual({ ok: true });
    expect(await createReport(db, report)).toEqual({ ok: false, error: "already_reported" });
    expect(await createReport(db, { ...report, category: "other" })).toEqual({ ok: false, error: "details_required" });
  });
});

describe("leaderboard", () => {
  it("only lists Players with Reputation from at least 10 Players", async () => {
    const popular = await addPlayer(db, { username: "Popular" });
    const quiet = await addPlayer(db, { username: "Quiet" });
    const givers = await Promise.all(Array.from({ length: 11 }, () => addPlayer(db, { linkedAt: longAgo })));
    for (const g of givers) await giveReputation(db, { giverUuid: g.uuid, receiverUuid: popular.uuid, value: 1, now });
    await giveReputation(db, { giverUuid: givers[0].uuid, receiverUuid: quiet.uuid, value: 1, now });
    const rows = await leaderboard(db, "highest");
    expect(rows.map((r) => r.username)).toEqual(["Popular"]);
    expect(rows[0]).toMatchObject({ positive: 11, negative: 0, net: 11 });
  });
});
