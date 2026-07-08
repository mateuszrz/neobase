ALTER TABLE "report_requests" ADD COLUMN "ip" text;--> statement-breakpoint
CREATE INDEX "report_requests_ip_idx" ON "report_requests" USING btree ("ip","created_at");