import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { testDb } from "@/test/db";
import { issueLinkCode, redeemLinkCode, sessionPlayer } from "./auth";
import { getPlayer } from "./players";

const steve = { uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", username: "Notch" };
const now = new Date("2026-11-10T15:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

describe("Link Codes", () => {
  it("signs the Player in and makes them a Linked Player", async () => {
    const { code } = await issueLinkCode(db, steve, now);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const result = await redeemLinkCode(db, code.toLowerCase(), later(1000));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await sessionPlayer(db, result.token, later(2000))).toMatchObject({ uuid: steve.uuid, username: "Notch" });
    expect((await getPlayer(db, steve.uuid))?.linkedAt).toEqual(later(1000));
  });

  it("works once and expires after 5 minutes", async () => {
    const first = await issueLinkCode(db, steve, now);
    await redeemLinkCode(db, first.code, now);
    expect(await redeemLinkCode(db, first.code, now)).toEqual({ ok: false, error: "used" });

    const second = await issueLinkCode(db, steve, now);
    expect(await redeemLinkCode(db, second.code, later(5 * 60 * 1000))).toEqual({ ok: false, error: "expired" });
    expect(await redeemLinkCode(db, "ZZZZZZ", now)).toEqual({ ok: false, error: "invalid" });
  });

  it("signs out older sessions when the Player links again", async () => {
    const a = await redeemLinkCode(db, (await issueLinkCode(db, steve, now)).code, now);
    const b = await redeemLinkCode(db, (await issueLinkCode(db, steve, now)).code, now);
    if (!a.ok || !b.ok) throw new Error("expected both to redeem");
    expect(await sessionPlayer(db, a.token, now)).toBeNull();
    expect(await sessionPlayer(db, b.token, now)).not.toBeNull();
  });

  it("keeps the first link date when relinking", async () => {
    await redeemLinkCode(db, (await issueLinkCode(db, steve, now)).code, now);
    await redeemLinkCode(db, (await issueLinkCode(db, steve, later(9999))).code, later(9999));
    expect((await getPlayer(db, steve.uuid))?.linkedAt).toEqual(now);
  });

  it("expires sessions after 30 days", async () => {
    const r = await redeemLinkCode(db, (await issueLinkCode(db, steve, now)).code, now);
    if (!r.ok) throw new Error("expected redeem");
    expect(await sessionPlayer(db, r.token, later(30 * 24 * 60 * 60 * 1000))).toBeNull();
  });
});
