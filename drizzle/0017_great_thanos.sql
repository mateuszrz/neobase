CREATE TABLE "articles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body_md" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"author" text,
	"tags" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "articles_locale_slug" ON "articles" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "articles_feed_idx" ON "articles" USING btree ("locale","status","published_at");