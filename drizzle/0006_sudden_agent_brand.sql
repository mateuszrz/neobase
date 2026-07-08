CREATE TABLE "report_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"competitors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"brand_fintech_id" text,
	"matched_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"report" jsonb NOT NULL,
	"model" text,
	"email" text,
	"unlocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "report_requests_created_idx" ON "report_requests" USING btree ("created_at");