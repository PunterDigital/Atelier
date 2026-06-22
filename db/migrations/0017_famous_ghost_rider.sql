ALTER TABLE "client" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "company_number" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "period_end" timestamp with time zone;