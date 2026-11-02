ALTER TABLE "reports" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "reputation_events" ADD COLUMN "admin_uuid" uuid;--> statement-breakpoint
ALTER TABLE "suspensions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "suspensions" ADD COLUMN "lifted_by" uuid;