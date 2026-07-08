CREATE TABLE "blog_posts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"published_at" timestamp with time zone,
	"snippet" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_natural_key" ON "blog_posts" USING btree ("fintech_id","external_id");--> statement-breakpoint
CREATE INDEX "blog_posts_feed_idx" ON "blog_posts" USING btree ("fintech_id","published_at");