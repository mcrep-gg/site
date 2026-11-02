/**
 * `npm run dev`: starts the local database, then the site.
 *
 * The database is PGlite (Postgres compiled to WASM) served over the Postgres protocol, so nothing
 * needs installing. It must be the only process that opens .data/pglite: Next dev runs several
 * processes, and PGlite corrupts its files if more than one opens them directly.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const DIR = ".data/pglite";
const PORT = 54329;

mkdirSync(DIR, { recursive: true });
const pglite = await PGlite.create(DIR);
const server = new PGLiteSocketServer({ db: pglite, host: "127.0.0.1", port: PORT, maxConnections: 4 });
await server.start();
console.log(`Local database listening on 127.0.0.1:${PORT} (${DIR})`);

const child = spawn("npm run db:migrate && npx next dev", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres` },
});

let stopping = false;
async function stop(code: number) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.stop();
  await pglite.close();
  process.exit(code);
}
child.on("exit", (code) => void stop(code ?? 0));
process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));
