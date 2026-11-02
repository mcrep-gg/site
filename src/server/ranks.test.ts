import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { canModerate, rankOf } from "@/lib/ranks";
import { addPlayer, testDb } from "@/test/db";
import { issueLinkCode, redeemLinkCode, sessionPlayer } from "./auth";
import { suspendPlayer } from "./admin";
import { getPlayer } from "./players";
import { listRanked, setRank } from "./ranks";

const now = new Date("2026-11-10T15:00:00Z");

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

describe("rankOf", () => {
  const owner = "069a79f4-44e9-4726-a5be-fca90e38aaf5";

  it("makes Players listed in ADMIN_UUIDS Admins, whatever is stored", () => {
    expect(rankOf(owner, null, owner)).toBe("admin");
    expect(rankOf(owner, "pro", owner.replace(/-/g, "").toUpperCase())).toBe("admin");
  });

  it("otherwise uses the stored rank, ignoring anything unknown", () => {
    expect(rankOf(owner, "staff", "")).toBe("staff");
    expect(rankOf(owner, "pro", "")).toBe("pro");
    expect(rankOf(owner, "admin", "")).toBeNull();
    expect(rankOf(owner, null, "")).toBeNull();
  });

  it("lets Admins and Staff moderate, not Pro", () => {
    expect(canModerate("admin")).toBe(true);
    expect(canModerate("staff")).toBe(true);
    expect(canModerate("pro")).toBe(false);
    expect(canModerate(null)).toBe(false);
  });
});

describe("setRank", () => {
  it("gives and takes away Staff and Pro, recording who did it", async () => {
    const admin = await addPlayer(db, { linkedAt: now });
    const steve = await addPlayer(db, { linkedAt: now });

    expect(await setRank(db, { playerUuid: steve.uuid, adminUuid: admin.uuid, rank: "pro", now, adminList: admin.uuid })).toEqual({ ok: true });
    expect((await getPlayer(db, steve.uuid))?.rank).toBe("pro");

    await setRank(db, { playerUuid: steve.uuid, adminUuid: admin.uuid, rank: "staff", now, adminList: admin.uuid });
    const [ranked] = await listRanked(db, "");
    expect(ranked).toMatchObject({ uuid: steve.uuid, rank: "staff", setAt: now, setBy: { uuid: admin.uuid, username: admin.username } });

    await setRank(db, { playerUuid: steve.uuid, adminUuid: admin.uuid, rank: null, now, adminList: admin.uuid });
    expect((await getPlayer(db, steve.uuid))?.rank).toBeNull();
  });

  it("can't change an Admin, a missing Player, or set the rank they already have", async () => {
    const admin = await addPlayer(db, { linkedAt: now });
    const steve = await addPlayer(db, { linkedAt: now });
    const base = { adminUuid: admin.uuid, now, adminList: admin.uuid };

    expect(await setRank(db, { ...base, playerUuid: admin.uuid, rank: "staff" })).toEqual({ ok: false, error: "is_admin" });
    expect(await setRank(db, { ...base, playerUuid: "00000000-0000-4000-8000-999999999999", rank: "pro" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await setRank(db, { ...base, playerUuid: steve.uuid, rank: null })).toEqual({ ok: false, error: "unchanged" });
  });
});

describe("listRanked", () => {
  it("lists Admins first, then Staff, then Pro, and leaves out everyone else", async () => {
    const admin = await addPlayer(db, { username: "Rooftop", linkedAt: now });
    const pro = await addPlayer(db, { username: "Alex", linkedAt: now });
    const staff = await addPlayer(db, { username: "Zed", linkedAt: now });
    await addPlayer(db, { username: "Nobody", linkedAt: now });
    await setRank(db, { playerUuid: pro.uuid, adminUuid: admin.uuid, rank: "pro", now, adminList: admin.uuid });
    await setRank(db, { playerUuid: staff.uuid, adminUuid: admin.uuid, rank: "staff", now, adminList: admin.uuid });

    const list = await listRanked(db, admin.uuid.toUpperCase());
    expect(list.map((p) => [p.username, p.rank])).toEqual([
      ["Rooftop", "admin"],
      ["Zed", "staff"],
      ["Alex", "pro"],
    ]);
    expect(list[0]).toMatchObject({ setAt: null, setBy: null });
  });
});

describe("sessionPlayer", () => {
  it("includes the signed-in Player's rank", async () => {
    const admin = await addPlayer(db, { linkedAt: now });
    const steve = await addPlayer(db, { linkedAt: now });
    await setRank(db, { playerUuid: steve.uuid, adminUuid: admin.uuid, rank: "staff", now, adminList: admin.uuid });
    const { code } = await issueLinkCode(db, steve, now);
    const redeemed = await redeemLinkCode(db, code, now);
    if (!redeemed.ok) throw new Error(redeemed.error);
    expect((await sessionPlayer(db, redeemed.token, now))?.rank).toBe("staff");
  });
});

describe("suspendPlayer", () => {
  it("won't suspend Staff until an Admin takes the rank away", async () => {
    const admin = await addPlayer(db, { linkedAt: now });
    const staff = await addPlayer(db, { linkedAt: now });
    await setRank(db, { playerUuid: staff.uuid, adminUuid: admin.uuid, rank: "staff", now, adminList: admin.uuid });
    const input = { playerUuid: staff.uuid, adminUuid: admin.uuid, reason: "Abusing reports", until: null, now };

    expect(await suspendPlayer(db, input)).toEqual({ ok: false, error: "moderator" });
    await setRank(db, { playerUuid: staff.uuid, adminUuid: admin.uuid, rank: null, now, adminList: admin.uuid });
    expect(await suspendPlayer(db, input)).toEqual({ ok: true });
  });
});
