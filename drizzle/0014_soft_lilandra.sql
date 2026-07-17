CREATE TABLE "casp_providers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"legal_entity" text,
	"country" text NOT NULL,
	"regulator" text NOT NULL,
	"services" text[],
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fintechs" ADD COLUMN "casp_provider_id" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "casp_providers_key" ON "casp_providers" USING btree ("provider","country");--> statement-breakpoint
CREATE INDEX "casp_providers_country_idx" ON "casp_providers" USING btree ("country");