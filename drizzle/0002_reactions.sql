CREATE TABLE "reactions" (
	"reputation_id" uuid NOT NULL,
	"player_uuid" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_reputation_id_player_uuid_emoji_pk" PRIMARY KEY("reputation_id","player_uuid","emoji"),
	CONSTRAINT "reactions_emoji_check" CHECK (emoji in ('heart', 'thumbs_up', 'thumbs_down', 'laugh', 'wow'))
);
--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_reputation_id_reputation_id_fk" FOREIGN KEY ("reputation_id") REFERENCES "public"."reputation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_player_uuid_players_uuid_fk" FOREIGN KEY ("player_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;