CREATE TABLE "sentiment_index" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"week" date NOT NULL,
	"composite" numeric(5, 2) NOT NULL,
	"review_score" numeric(5, 2),
	"news_score" numeric(5, 2),
	"review_volume" bigint,
	"news_volume" integer,
	"review_weight" numeric(4, 3),
	"news_weight" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sentiment_index" ADD CONSTRAINT "sentiment_index_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sentiment_index_key" ON "sentiment_index" USING btree ("fintech_id","week");