CREATE TABLE "news_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"country" char(2) DEFAULT 'ZZ' NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"published_at" timestamp with time zone,
	"title" text NOT NULL,
	"publisher" text,
	"snippet" text,
	"sentiment" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"network" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"posted_at" timestamp with time zone,
	"text" text,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_natural_key" ON "news_items" USING btree ("fintech_id","external_id");--> statement-breakpoint
CREATE INDEX "news_items_feed_idx" ON "news_items" USING btree ("fintech_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_natural_key" ON "social_posts" USING btree ("fintech_id","network","external_id");--> statement-breakpoint
CREATE INDEX "social_posts_feed_idx" ON "social_posts" USING btree ("fintech_id","posted_at");