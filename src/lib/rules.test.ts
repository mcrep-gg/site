import { describe, expect, it } from "vitest";
import { dailyLimit, decideGive, formatNet, newPlayerDaysLeft, nextUtcReset, validateReply } from "./rules";

const now = new Date("2026-11-10T15:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const base = {
  giverUuid: "a",
  receiverUuid: "b",
  value: 1 as const,
  reason: null,
  giverLinkedAt: daysAgo(30),
  giverSuspended: false,
  usedToday: 0,
  existing: null,
  now,
};

describe("decideGive", () => {
  it("lets a Linked Player give a +1 without a reason", () => {
    expect(decideGive(base)).toEqual({ ok: true, kind: "give", reason: null });
  });

  it("requires a reason for a -1", () => {
    expect(decideGive({ ...base, value: -1, reason: "   " })).toEqual({ ok: false, error: "reason_required" });
    expect(decideGive({ ...base, value: -1, reason: "scammed me" })).toMatchObject({ ok: true, reason: "scammed me" });
  });

  it("rejects reasons over 280 characters", () => {
    expect(decideGive({ ...base, reason: "x".repeat(281) })).toEqual({ ok: false, error: "reason_too_long" });
  });

  it("refuses giving yourself Reputation", () => {
    expect(decideGive({ ...base, receiverUuid: "a" })).toEqual({ ok: false, error: "self" });
  });

  it("refuses Players who never linked, and suspended Players", () => {
    expect(decideGive({ ...base, giverLinkedAt: null })).toEqual({ ok: false, error: "not_linked" });
    expect(decideGive({ ...base, giverSuspended: true })).toEqual({ ok: false, error: "suspended" });
  });

  it("allows 3 a day in the first 7 days after linking, then 10", () => {
    expect(decideGive({ ...base, giverLinkedAt: daysAgo(0), usedToday: 2 }).ok).toBe(true);
    expect(decideGive({ ...base, giverLinkedAt: daysAgo(6.9), usedToday: 3 })).toEqual({ ok: false, error: "limit_reached" });
    expect(decideGive({ ...base, giverLinkedAt: daysAgo(7), usedToday: 3 }).ok).toBe(true);
    expect(decideGive({ ...base, usedToday: 10 })).toEqual({ ok: false, error: "limit_reached" });
  });

  it("treats a new value as a change, which counts toward the limit", () => {
    const existing = { value: 1 as const, reason: null };
    expect(decideGive({ ...base, value: -1, reason: "no", existing })).toMatchObject({ ok: true, kind: "change" });
    expect(decideGive({ ...base, value: -1, reason: "no", existing, usedToday: 10 })).toEqual({ ok: false, error: "limit_reached" });
  });

  it("does not spend the limit when nothing changed", () => {
    const existing = { value: 1 as const, reason: "fair trade" };
    expect(decideGive({ ...base, reason: " fair trade ", existing, usedToday: 10 })).toMatchObject({ ok: true, kind: "unchanged" });
  });
});

describe("limits", () => {
  it("resets at 00:00 UTC", () => {
    expect(nextUtcReset(now).toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });

  it("counts new-Player days left", () => {
    expect(dailyLimit(daysAgo(2), now)).toBe(3);
    expect(newPlayerDaysLeft(daysAgo(2.5), now)).toBe(5);
    expect(newPlayerDaysLeft(daysAgo(8), now)).toBe(0);
  });
});

describe("validateReply", () => {
  it("only lets the receiver reply, with 1 to 280 characters", () => {
    expect(validateReply("hi", "b", "b")).toBeNull();
    expect(validateReply("hi", "a", "b")).toBe("not_receiver");
    expect(validateReply("  ", "b", "b")).toBe("empty");
    expect(validateReply("x".repeat(281), "b", "b")).toBe("too_long");
  });
});

describe("formatNet", () => {
  it("formats the net score with both counts", () => {
    expect(formatNet(15, 3)).toEqual({ net: "+12", counts: "(15 / 3)", sign: "pos" });
    expect(formatNet(2, 6)).toEqual({ net: "−4", counts: "(2 / 6)", sign: "neg" });
    expect(formatNet(0, 0)).toEqual({ net: "0", counts: "(0 / 0)", sign: "zero" });
  });
});
