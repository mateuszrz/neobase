CREATE TABLE "fintechs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'neobank' NOT NULL,
	"name" text NOT NULL,
	"country" char(2),
	"logo_svg" text,
	"color" text,
	"website" text,
	"founded" integer,
	"headquarters" text,
	"employees" integer,
	"valuation_usd" bigint,
	"status" text,
	"description" text,
	"about" text,
	"tags" text[],
	"available_in" char(2)[],
	"licenses" jsonb,
	"socials" jsonb,
	"key_people" jsonb,
	"investors" jsonb,
	"subsidiaries" jsonb,
	"history" jsonb,
	"faqs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" text NOT NULL,
	"actor" text NOT NULL,
	"apify_run_id" text,
	"dataset_id" text,
	"status" text DEFAULT 'started' NOT NULL,
	"stats" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ingest_runs_run_key_unique" UNIQUE("run_key")
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"fintech_id" text NOT NULL,
	"kind" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"snapshot_date" date NOT NULL,
	"rating" numeric(3, 2),
	"review_count" bigint,
	"review_count_delta" bigint,
	"sentiment_pos" numeric(4, 1),
	"sentiment_neg" numeric(4, 1),
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"fintech_id" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"external_id" text NOT NULL,
	"rating" smallint,
	"title" text,
	"body" text,
	"posted_at" timestamp with time zone,
	"sentiment_label" text,
	"sentiment_score" numeric(4, 3),
	"sentiment_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fintech_id" text NOT NULL,
	"kind" text NOT NULL,
	"external_ref" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"apify_actor_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fintechs_country_idx" ON "fintechs" USING btree ("country");--> statement-breakpoint
CREATE INDEX "fintechs_type_idx" ON "fintechs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ingest_runs_status_idx" ON "ingest_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_queue_claim_idx" ON "job_queue" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_snapshots_natural_key" ON "metric_snapshots" USING btree ("source_id","country","snapshot_date");--> statement-breakpoint
CREATE INDEX "metric_snapshots_series_idx" ON "metric_snapshots" USING btree ("fintech_id","kind","country","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_natural_key" ON "reviews" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "reviews_fintech_idx" ON "reviews" USING btree ("fintech_id","posted_at");--> statement-breakpoint
CREATE INDEX "reviews_unclassified_idx" ON "reviews" USING btree ("id") WHERE "reviews"."sentiment_label" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_natural_key" ON "sources" USING btree ("fintech_id","kind","external_ref","country");--> statement-breakpoint
CREATE INDEX "sources_fintech_idx" ON "sources" USING btree ("fintech_id");--> statement-breakpoint
CREATE INDEX "sources_active_kind_idx" ON "sources" USING btree ("active","kind");