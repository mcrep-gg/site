/** Admins are the Players whose UUIDs are listed, comma-separated, in ADMIN_UUIDS. Dashes and case don't matter. */

const compact = (uuid: string) => uuid.replace(/-/g, "").trim().toLowerCase();

export function isAdmin(uuid: string, list = process.env.ADMIN_UUIDS ?? ""): boolean {
  const target = compact(uuid);
  return target !== "" && list.split(",").some((entry) => compact(entry) === target);
}

export const SUSPENSION_REASON_MAX = 280;

/** Suspension lengths an Admin can pick, keyed by days. `forever` lasts until an Admin lifts it. */
export const SUSPENSION_LENGTHS = { "1": "1 day", "7": "7 days", "30": "30 days", forever: "Until lifted" } as const;
