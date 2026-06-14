CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"vendor" text,
	"category" text,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"receipt_data_url" text,
	"receipt_filename" text,
	"receipt_mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_business_id_idx" ON "expense" USING btree ("business_id");