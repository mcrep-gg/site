import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative, not "@/": drizzle-kit loads this file without the tsconfig paths.
import { REACTION_KEYS, type Reaction } from "../lib/rules";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** A Minecraft Java Edition account. `uuid` is the identity; `username` is a display label that can change. */
export const players = pgTable(
  "players",
  {
    uuid: uuid("uuid").primaryKey(),
    username: text("username").notNull(),
    /** First time this Player redeemed a Link Code. Null means never linked. */
    linkedAt: ts("linked_at"),
    /** When `username` was last confirmed with Mojang. */
    refreshedAt: ts("refreshed_at").notNull().defaultNow(),
  },
  (t) => [index("players_username_lower_idx").on(sql`lower(${t.username})`)],
);

/** Single-use codes the Link Server issues. Stored hashed. */
export const linkCodes = pgTable("link_codes", {
  codeHash: text("code_hash").primaryKey(),
  playerUuid: uuid("player_uuid")
    .notNull()
    .references(() => players.uuid, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

/** Website sign-in sessions. The cookie holds the token; only its hash is stored. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    playerUuid: uuid("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_player_idx").on(t.playerUuid)],
);

/** The current +1 or -1 one Player has given another. At most one per pair. */
export const reputation = pgTable(
  "reputation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    giverUuid: uuid("giver_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    receiverUuid: uuid("receiver_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    value: smallint("value").notNull(),
    reason: text("reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reputation_pair_idx").on(t.giverUuid, t.receiverUuid),
    index("reputation_receiver_idx").on(t.receiverUuid),
    check("reputation_value_check", sql`${t.value} in (1, -1)`),
    check("reputation_not_self_check", sql`${t.giverUuid} <> ${t.receiverUuid}`),
    check("reputation_negative_reason_check", sql`${t.value} = 1 or ${t.reason} is not null`),
  ],
);

/**
 * Every give, change and removal, kept for Admins after the current row is gone.
 * Also the ledger the daily giving limit counts against.
 */
export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: serial("id").primaryKey(),
    giverUuid: uuid("giver_uuid").notNull(),
    receiverUuid: uuid("receiver_uuid").notNull(),
    action: text("action", { enum: ["give", "change", "remove", "admin_remove"] }).notNull(),
    value: smallint("value").notNull(),
    reason: text("reason"),
    at: ts("at").notNull().defaultNow(),
    /** The Admin who did it, for `admin_remove`. Null for a Player's own actions. */
    adminUuid: uuid("admin_uuid"),
  },
  (t) => [index("reputation_events_giver_at_idx").on(t.giverUuid, t.at)],
);

/** The one public Reply a Player can attach to a +1 or -1 they received. */
export const replies = pgTable("replies", {
  reputationId: uuid("reputation_id")
    .primaryKey()
    .references(() => reputation.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/**
 * Emoji reactions on a +1 or -1. Each Player can add each emoji once per entry.
 * They go with the Reputation when it is changed or removed, like a Reply.
 */
export const reactions = pgTable(
  "reactions",
  {
    reputationId: uuid("reputation_id")
      .notNull()
      .references(() => reputation.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    emoji: text("emoji").$type<Reaction>().notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.reputationId, t.playerUuid, t.emoji] }),
    check("reactions_emoji_check", sql.raw(`emoji in (${REACTION_KEYS.map((k) => `'${k}'`).join(", ")})`)),
  ],
);

/** A request for an Admin to review a +1 or -1. Keeps a copy so it survives the Reputation changing. */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reputationId: uuid("reputation_id").references(() => reputation.id, { onDelete: "set null" }),
    reporterUuid: uuid("reporter_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    category: text("category").notNull(),
    details: text("details"),
    giverUuid: uuid("giver_uuid").notNull(),
    receiverUuid: uuid("receiver_uuid").notNull(),
    value: smallint("value").notNull(),
    reason: text("reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
    /** How an Admin resolved it: left the Reputation alone, or removed it. */
    resolution: text("resolution", { enum: ["dismissed", "removed"] }),
    resolvedBy: uuid("resolved_by"),
  },
  (t) => [uniqueIndex("reports_reporter_reputation_idx").on(t.reporterUuid, t.reputationId)],
);

/** An Admin's ban on a Player giving Reputation. `until` null means indefinite. */
export const suspensions = pgTable(
  "suspensions",
  {
    id: serial("id").primaryKey(),
    playerUuid: uuid("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    until: ts("until"),
    createdAt: ts("created_at").notNull().defaultNow(),
    liftedAt: ts("lifted_at"),
    createdBy: uuid("created_by"),
    liftedBy: uuid("lifted_by"),
  },
  (t) => [index("suspensions_player_idx").on(t.playerUuid)],
);
