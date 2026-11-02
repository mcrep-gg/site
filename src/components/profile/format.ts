/** Small, pure formatters for the profile page. Run on the server so text never differs at hydration. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "just now", "5 minutes ago", "2 hours ago", "4 days ago", "2 weeks ago", "3 months ago", "1 year ago". */
export function timeAgo(date: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - date.getTime());
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${plural(Math.floor(ms / MINUTE), "minute")} ago`;
  if (ms < DAY) return `${plural(Math.floor(ms / HOUR), "hour")} ago`;
  const days = Math.floor(ms / DAY);
  if (days < 7) return `${plural(days, "day")} ago`;
  if (days < 30) return `${plural(Math.floor(days / 7), "week")} ago`;
  if (days < 365) return `${plural(Math.max(1, Math.floor(days / 30)), "month")} ago`;
  return `${plural(Math.floor(days / 365), "year")} ago`;
}

/** "7 h 42 min" until a moment; "less than a minute" when it is about to happen. */
export function timeUntil(date: Date, now: Date): string {
  const ms = Math.max(0, date.getTime() - now.getTime());
  const totalMin = Math.ceil(ms / MINUTE);
  if (totalMin < 1) return "less than a minute";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "14 Nov 2026", in UTC like the rest of the site's limits. */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
