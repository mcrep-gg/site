/**
 * Site ranks, highest first. Admin comes from ADMIN_UUIDS, so nobody can take it away from the site.
 * Staff and Pro are stored on the Player by an Admin. Pro is for donators and only shows a badge for now.
 */

// Relative, not "@/": drizzle-kit loads this file through the schema without the tsconfig paths.
import { isAdmin } from "./admin";

export const RANKS = ["admin", "staff", "pro"] as const;
export type Rank = (typeof RANKS)[number];

/** The ranks an Admin can give from the site. */
export const STORED_RANKS = ["staff", "pro"] as const;
export type StoredRank = (typeof STORED_RANKS)[number];

export const RANK_LABELS: Record<Rank, string> = { admin: "Admin", staff: "Staff", pro: "Pro" };

export const isStoredRank = (value: unknown): value is StoredRank => value === "staff" || value === "pro";

/** A Player's rank: Admin when listed in ADMIN_UUIDS, otherwise the one an Admin stored, if any. */
export function rankOf(uuid: string, stored: string | null, adminList?: string): Rank | null {
  if (isAdmin(uuid, adminList)) return "admin";
  return isStoredRank(stored) ? stored : null;
}

/** Admins and Staff work Reports, suspend Players and remove Reputation. Only Admins give out ranks. */
export const canModerate = (rank: Rank | null): boolean => rank === "admin" || rank === "staff";
