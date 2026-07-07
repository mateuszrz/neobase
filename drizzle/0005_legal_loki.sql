CREATE TABLE "ai_summaries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"kind" text DEFAULT 'weekly_brief' NOT NULL,
	"summary" text NOT NULL,
	"generated_for" date,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_summaries_key" ON "ai_summaries" USING btree ("fintech_id","kind");