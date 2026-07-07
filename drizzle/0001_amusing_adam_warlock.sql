CREATE TABLE "content_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"kind" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"source_id" uuid NOT NULL,
	"from_snapshot_id" bigint,
	"to_snapshot_id" bigint NOT NULL,
	"from_date" date,
	"to_date" date NOT NULL,
	"change_kinds" text[],
	"diff" jsonb,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"fintech_id" text NOT NULL,
	"kind" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"snapshot_date" date NOT NULL,
	"url" text NOT NULL,
	"http_status" integer,
	"fetched_via" text,
	"content_hash" text NOT NULL,
	"extracted" jsonb,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_changes" ADD CONSTRAINT "content_changes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_changes_to_snapshot_key" ON "content_changes" USING btree ("to_snapshot_id");--> statement-breakpoint
CREATE INDEX "content_changes_feed_idx" ON "content_changes" USING btree ("fintech_id","to_date");--> statement-breakpoint
CREATE UNIQUE INDEX "content_snapshots_natural_key" ON "content_snapshots" USING btree ("source_id","country","snapshot_date");--> statement-breakpoint
CREATE INDEX "content_snapshots_series_idx" ON "content_snapshots" USING btree ("fintech_id","kind","country","snapshot_date");