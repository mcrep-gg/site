import { beforeEach, describe, expect, it } from "vitest";
import { reputationEvents, suspensions } from "@/db/schema";
import type { Db } from "@/db/client";
import { addPlayer, testDb } from "@/test/db";
import {
  createReport,
  giveReputation,
  givenReputation,
  giverStatus,
  leaderboard,
  newestReputation,
  reactionsFor,
  receivedReputation,
  removeReputation,
  saveReply,
  toggleReaction,
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

describe("givenReputation", () => {
  it("lists what a Player gave, newest first, with each receiver's name and Reply", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db, { linkedAt: longAgo });
    const ava = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now: new Date(now.getTime() - 60_000) });
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: -1, reason: "kept my diamonds", now });
    // Given to Alex, so it belongs on Alex's received list, not here.
    await giveReputation(db, { giverUuid: steve.uuid, receiverUuid: alex.uuid, value: 1, now });
    const [toSteve] = await receivedReputation(db, steve.uuid);
    await saveReply(db, { viewerUuid: steve.uuid, reputationId: toSteve.id, text: "Thanks!" });

    const given = await givenReputation(db, alex.uuid);
    expect(given.map((e) => [e.receiver.uuid, e.value])).toEqual([
      [ava.uuid, -1],
      [steve.uuid, 1],
    ]);
    expect(given[0]).toMatchObject({ reason: "kept my diamonds", receiver: { username: ava.username }, reply: null });
    expect(given[1].reply?.text).toBe("Thanks!");
  });
});

describe("newestReputation", () => {
  it("lists the latest +1/-1s from anyone, newest first, with both Players' names", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db);
    const ava = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: steve.uuid, value: 1, now: new Date(now.getTime() - 60_000) });
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: -1, reason: "kept my diamonds", now });

    const feed = await newestReputation(db, 10);
    expect(feed.map((e) => [e.receiver.uuid, e.value])).toEqual([
      [ava.uuid, -1],
      [steve.uuid, 1],
    ]);
    expect(feed[0]).toMatchObject({ reason: "kept my diamonds", giver: { uuid: alex.uuid, username: alex.username } });
    expect(await newestReputation(db, 1)).toHaveLength(1);
  });
});

describe("toggleReaction", () => {
  it("adds a reaction, and takes it back when the same emoji is picked again", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db, { linkedAt: longAgo });
    const ava = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: 1, now });
    const [entry] = await receivedReputation(db, ava.uuid);

    expect(await toggleReaction(db, { playerUuid: steve.uuid, reputationId: entry.id, emoji: "heart", now })).toEqual({ ok: true, added: true });
    await toggleReaction(db, { playerUuid: alex.uuid, reputationId: entry.id, emoji: "heart", now });
    await toggleReaction(db, { playerUuid: steve.uuid, reputationId: entry.id, emoji: "laugh", now });
    expect((await reactionsFor(db, [entry.id], steve.uuid)).get(entry.id)).toEqual([
      { emoji: "heart", count: 2, mine: true },
      { emoji: "laugh", count: 1, mine: true },
    ]);

    expect(await toggleReaction(db, { playerUuid: steve.uuid, reputationId: entry.id, emoji: "heart", now })).toEqual({ ok: true, added: false });
    expect((await reactionsFor(db, [entry.id], steve.uuid)).get(entry.id)).toEqual([
      { emoji: "heart", count: 1, mine: false },
      { emoji: "laugh", count: 1, mine: true },
    ]);
  });

  it("only lets Linked Players who are not suspended react, with a known emoji", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const unlinked = await addPlayer(db);
    const ava = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: 1, now });
    const [entry] = await receivedReputation(db, ava.uuid);

    const react = (playerUuid: string, emoji = "heart") => toggleReaction(db, { playerUuid, reputationId: entry.id, emoji, now });
    expect(await react(unlinked.uuid)).toEqual({ ok: false, error: "not_linked" });
    expect(await react(alex.uuid, "poop")).toEqual({ ok: false, error: "bad_emoji" });
    await db.insert(suspensions).values({ playerUuid: alex.uuid, reason: "spam" });
    expect(await react(alex.uuid)).toEqual({ ok: false, error: "suspended" });
    expect(await reactionsFor(db, [entry.id], null)).toEqual(new Map());
  });

  it("drops reactions when the Reputation they were on is changed", async () => {
    const alex = await addPlayer(db, { linkedAt: longAgo });
    const steve = await addPlayer(db, { linkedAt: longAgo });
    const ava = await addPlayer(db);
    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: 1, now });
    const [entry] = await receivedReputation(db, ava.uuid);
    await toggleReaction(db, { playerUuid: steve.uuid, reputationId: entry.id, emoji: "thumbs_up", now });

    await giveReputation(db, { giverUuid: alex.uuid, receiverUuid: ava.uuid, value: -1, reason: "changed my mind", now });
    const [changed] = await receivedReputation(db, ava.uuid);
    expect(await reactionsFor(db, [entry.id, changed.id], steve.uuid)).toEqual(new Map());
    expect(await toggleReaction(db, { playerUuid: steve.uuid, reputationId: entry.id, emoji: "heart", now })).toEqual({
      ok: false,
      error: "not_found",
    });
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
