CREATE TABLE "invoice_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"tax_treatment" text NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"anchor_day" integer,
	"start_date" timestamp with time zone NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"occurrence_limit" integer,
	"net_terms_days" integer DEFAULT 0 NOT NULL,
	"auto_issue" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_schedule_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_schedule" ADD CONSTRAINT "invoice_schedule_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_schedule" ADD CONSTRAINT "invoice_schedule_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_schedule" ADD CONSTRAINT "invoice_schedule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_schedule_line" ADD CONSTRAINT "invoice_schedule_line_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_schedule_line" ADD CONSTRAINT "invoice_schedule_line_schedule_id_invoice_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."invoice_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_schedule_business_id_idx" ON "invoice_schedule" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "invoice_schedule_client_id_idx" ON "invoice_schedule" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoice_schedule_due_idx" ON "invoice_schedule" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "invoice_schedule_line_business_id_idx" ON "invoice_schedule_line" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "invoice_schedule_line_schedule_id_idx" ON "invoice_schedule_line" USING btree ("schedule_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_schedule_id_invoice_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."invoice_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_schedule_id_idx" ON "invoice" USING btree ("schedule_id");