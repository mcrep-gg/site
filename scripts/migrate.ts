import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db/client";

const db = createDb();
await migrate(db as never, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
process.exit(0);
