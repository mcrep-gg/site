import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

/**
 * Connects to DATABASE_URL. In development `npm run dev` provides it: it starts a PGlite
 * Postgres server that alone owns the files in .data/pglite (Next runs several processes,
 * and PGlite corrupts its files if more than one opens them directly).
 * Pass `memory: true` for a throwaway in-process database (tests).
 */
export function createDb(opts: { memory?: boolean } = {}): Db {
  if (opts.memory) return drizzlePglite(new PGlite(), { schema });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. In development, start the site with `npm run dev`, which runs the local database.");
  // The dev PGlite server shares one Postgres session between its connections, so named prepared
  // statements would collide and a transaction could interleave with other queries.
  const dev = process.env.NODE_ENV !== "production";
  const client = postgres(url, dev ? { max: 1, prepare: false } : {});
  // Both drivers expose the same Postgres query API; only the driver type differs.
  return drizzlePostgres(client, { schema }) as unknown as Db;
}
