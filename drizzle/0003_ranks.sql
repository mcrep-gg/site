ALTER TABLE "players" ADD COLUMN "rank" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rank_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rank_set_by" uuid;--> statement-breakpoint
CREATE INDEX "players_rank_idx" ON "players" USING btree ("rank");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_rank_check" CHECK ("players"."rank" in ('staff', 'pro'));