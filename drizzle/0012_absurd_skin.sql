ALTER TABLE "sentiment_index" ADD COLUMN "mention_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "sentiment_index" ADD COLUMN "mention_volume" integer;--> statement-breakpoint
ALTER TABLE "sentiment_index" ADD COLUMN "mention_weight" numeric(4, 3);