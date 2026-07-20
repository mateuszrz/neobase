CREATE TABLE "fintech_translations" (
	"fintech_id" text NOT NULL,
	"locale" text NOT NULL,
	"description" text,
	"about" text,
	"faqs" jsonb,
	"translated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fintech_translations" ADD CONSTRAINT "fintech_translations_fintech_id_fintechs_id_fk" FOREIGN KEY ("fintech_id") REFERENCES "public"."fintechs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fintech_translations_key" ON "fintech_translations" USING btree ("fintech_id","locale");