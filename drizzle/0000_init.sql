CREATE TABLE "link_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"player_uuid" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"linked_at" timestamp with time zone,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"reputation_id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reputation_id" uuid,
	"reporter_uuid" uuid NOT NULL,
	"category" text NOT NULL,
	"details" text,
	"giver_uuid" uuid NOT NULL,
	"receiver_uuid" uuid NOT NULL,
	"value" smallint NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giver_uuid" uuid NOT NULL,
	"receiver_uuid" uuid NOT NULL,
	"value" smallint NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reputation_value_check" CHECK ("reputation"."value" in (1, -1)),
	CONSTRAINT "reputation_not_self_check" CHECK ("reputation"."giver_uuid" <> "reputation"."receiver_uuid"),
	CONSTRAINT "reputation_negative_reason_check" CHECK ("reputation"."value" = 1 or "reputation"."reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "reputation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"giver_uuid" uuid NOT NULL,
	"receiver_uuid" uuid NOT NULL,
	"action" text NOT NULL,
	"value" smallint NOT NULL,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"player_uuid" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_uuid" uuid NOT NULL,
	"reason" text NOT NULL,
	"until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_player_uuid_players_uuid_fk" FOREIGN KEY ("player_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_reputation_id_reputation_id_fk" FOREIGN KEY ("reputation_id") REFERENCES "public"."reputation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reputation_id_reputation_id_fk" FOREIGN KEY ("reputation_id") REFERENCES "public"."reputation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_uuid_players_uuid_fk" FOREIGN KEY ("reporter_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation" ADD CONSTRAINT "reputation_giver_uuid_players_uuid_fk" FOREIGN KEY ("giver_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation" ADD CONSTRAINT "reputation_receiver_uuid_players_uuid_fk" FOREIGN KEY ("receiver_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_uuid_players_uuid_fk" FOREIGN KEY ("player_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_player_uuid_players_uuid_fk" FOREIGN KEY ("player_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_username_lower_idx" ON "players" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_reputation_idx" ON "reports" USING btree ("reporter_uuid","reputation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reputation_pair_idx" ON "reputation" USING btree ("giver_uuid","receiver_uuid");--> statement-breakpoint
CREATE INDEX "reputation_receiver_idx" ON "reputation" USING btree ("receiver_uuid");--> statement-breakpoint
CREATE INDEX "reputation_events_giver_at_idx" ON "reputation_events" USING btree ("giver_uuid","at");--> statement-breakpoint
CREATE INDEX "sessions_player_idx" ON "sessions" USING btree ("player_uuid");--> statement-breakpoint
CREATE INDEX "suspensions_player_idx" ON "suspensions" USING btree ("player_uuid");