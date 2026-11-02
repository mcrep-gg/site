import "server-only";
import { createDb, type Db } from "./client";

// Reuse one connection across dev hot reloads; PGlite allows only one open handle per data dir.
const globalForDb = globalThis as unknown as { mcrepDb?: Db };

export const db: Db = globalForDb.mcrepDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.mcrepDb = db;

export type { Db };
