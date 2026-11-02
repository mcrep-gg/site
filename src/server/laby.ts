import { cacheLife } from "next/cache";

// Laby.net keeps the name history Mojang stopped publishing. It is not a public API (see
// https://github.com/n3liz/Laby-API-Documentation), so every failure just means "no history".

export type PastName = {
  name: string;
  /** When the account switched to this name. Null for the name it was created with. */
  changedAt: Date | null;
  /** False when Laby only knows roughly when the change happened. */
  accurate: boolean;
};

type LabyName = { name?: string; username?: string; changed_at: string | null; accurate: boolean };

/** The account's names, oldest first. Throws when Laby can't be reached, so failures aren't cached. */
async function fetchNames(uuid: string): Promise<{ name: string; changedAt: string | null; accurate: boolean }[]> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(`https://laby.net/api/v3/user/${encodeURIComponent(uuid)}/names`, {
    headers: { accept: "application/json", "user-agent": "mcrep.gg" },
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Laby name lookup failed: ${res.status}`);
  const body = (await res.json()) as LabyName[];
  // The docs call it "username", the live API sends "name".
  return body.flatMap((n) => {
    const name = n.name ?? n.username;
    return name ? [{ name, changedAt: n.changed_at, accurate: n.accurate }] : [];
  });
}

/** Every name the account has had, newest first. Empty when Laby has nothing or is down. */
export async function nameHistory(uuid: string): Promise<PastName[]> {
  try {
    const names = await fetchNames(uuid);
    return names.map((n) => ({ ...n, changedAt: n.changedAt ? new Date(n.changedAt) : null })).reverse();
  } catch {
    return [];
  }
}
