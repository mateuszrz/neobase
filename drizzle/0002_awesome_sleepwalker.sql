ALTER TABLE "sources" ADD COLUMN "scope" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "cadence" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
CREATE INDEX "sources_cadence_idx" ON "sources" USING btree ("cadence","active");