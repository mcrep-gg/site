/** The rules for giving Reputation, Replies and Reports. Pure: no database, no clock. */

export const REASON_MAX = 280;
export const REPLY_MAX = 280;
export const REPORT_DETAILS_MAX = 500;
export const NEW_PLAYER_DAYS = 7;
export const NEW_PLAYER_DAILY_LIMIT = 3;
export const DAILY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export type Value = 1 | -1;

/** Daily limits reset at 00:00 UTC. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextUtcReset(now: Date): Date {
  return new Date(startOfUtcDay(now).getTime() + DAY_MS);
}

/** 3 a day for a Player's first 7 days after linking, then 10 a day. */
export function dailyLimit(linkedAt: Date, now: Date): number {
  return isNewPlayer(linkedAt, now) ? NEW_PLAYER_DAILY_LIMIT : DAILY_LIMIT;
}

export function isNewPlayer(linkedAt: Date, now: Date): boolean {
  return now.getTime() - linkedAt.getTime() < NEW_PLAYER_DAYS * DAY_MS;
}

/** Whole days left before a new Player gets the full limit (0 once they have it). */
export function newPlayerDaysLeft(linkedAt: Date, now: Date): number {
  const ms = linkedAt.getTime() + NEW_PLAYER_DAYS * DAY_MS - now.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

export function normalizeText(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export type GiveError =
  | "not_linked"
  | "self"
  | "suspended"
  | "limit_reached"
  | "reason_required"
  | "reason_too_long";

export type GiveDecision =
  | { ok: true; kind: "give" | "change" | "unchanged"; reason: string | null }
  | { ok: false; error: GiveError };

export function decideGive(input: {
  giverUuid: string;
  receiverUuid: string;
  value: Value;
  reason: string | null | undefined;
  giverLinkedAt: Date | null;
  giverSuspended: boolean;
  /** Gives and changes this giver has made since 00:00 UTC. */
  usedToday: number;
  existing: { value: Value; reason: string | null } | null;
  now: Date;
}): GiveDecision {
  if (!input.giverLinkedAt) return { ok: false, error: "not_linked" };
  if (input.giverUuid === input.receiverUuid) return { ok: false, error: "self" };
  if (input.giverSuspended) return { ok: false, error: "suspended" };

  const reason = normalizeText(input.reason);
  if (input.value === -1 && !reason) return { ok: false, error: "reason_required" };
  if (reason && reason.length > REASON_MAX) return { ok: false, error: "reason_too_long" };

  const { existing } = input;
  if (existing && existing.value === input.value && existing.reason === reason) {
    return { ok: true, kind: "unchanged", reason };
  }
  // Giving and changing count toward the limit; removing never does.
  if (input.usedToday >= dailyLimit(input.giverLinkedAt, input.now)) {
    return { ok: false, error: "limit_reached" };
  }
  return { ok: true, kind: existing ? "change" : "give", reason };
}

export type ReplyError = "not_receiver" | "empty" | "too_long";

export function validateReply(text: string, viewerUuid: string, receiverUuid: string): ReplyError | null {
  if (viewerUuid !== receiverUuid) return "not_receiver";
  const t = text.trim();
  if (!t) return "empty";
  if (t.length > REPLY_MAX) return "too_long";
  return null;
}

export const REPORT_CATEGORIES = {
  false: "It's false or never happened",
  abusive: "Harassment, slurs or personal info",
  fake_account: "Spam, or from a fake or alt account",
  swap_or_revenge: "Part of a Reputation swap or revenge",
  other: "Something else",
} as const;

export type ReportCategory = keyof typeof REPORT_CATEGORIES;

export function isReportCategory(value: string): value is ReportCategory {
  return Object.hasOwn(REPORT_CATEGORIES, value);
}

export type ReportError = "bad_category" | "details_required" | "details_too_long";

/** "Something else" needs details; every other category makes them optional. */
export function validateReport(category: string, details: string | null | undefined): ReportError | null {
  if (!isReportCategory(category)) return "bad_category";
  const d = normalizeText(details);
  if (category === "other" && !d) return "details_required";
  if (d && d.length > REPORT_DETAILS_MAX) return "details_too_long";
  return null;
}

/** Net Reputation and its two counts, as shown everywhere: "+12 (15 / 3)". */
export function formatNet(positive: number, negative: number): { net: string; counts: string; sign: "pos" | "neg" | "zero" } {
  const n = positive - negative;
  return {
    net: n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0",
    counts: `(${positive} / ${negative})`,
    sign: n > 0 ? "pos" : n < 0 ? "neg" : "zero",
  };
}
