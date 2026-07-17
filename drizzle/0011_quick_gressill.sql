CREATE TABLE "mentions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fintech_id" text NOT NULL,
	"network" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"author_name" text,
	"author_handle" text,
	"posted_at" timestamp with time zone,
	"text" text,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"sentiment" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_natural_key" ON "mentions" USING btree ("fintech_id","network","external_id");--> statement-breakpoint
CREATE INDEX "mentions_feed_idx" ON "mentions" USING btree ("fintech_id","posted_at");