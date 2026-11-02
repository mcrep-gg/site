import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb, type Db } from "@/db/client";
import { players } from "@/db/schema";

/** A fresh in-memory Postgres with all migrations applied. */
export async function testDb(): Promise<Db> {
  const db = createDb({ memory: true });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

let n = 0;
/** Inserts a Player; pass `linkedAt` to make them a Linked Player. */
export async function addPlayer(db: Db, opts: { username?: string; linkedAt?: Date | null } = {}) {
  n += 1;
  const uuid = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const username = opts.username ?? `Player_${n}`;
  await db.insert(players).values({ uuid, username, linkedAt: opts.linkedAt ?? null });
  return { uuid, username };
}
