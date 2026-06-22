CREATE TABLE "client_member_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"bill_rate_minor" integer NOT NULL,
	"bill_rate_currency" text NOT NULL,
	"bill_rate_unit" text DEFAULT 'hour' NOT NULL,
	"internal_cost_minor" integer,
	"internal_cost_currency" text,
	"internal_cost_unit" text DEFAULT 'hour' NOT NULL,
	"budget_minor" integer,
	"budget_currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_member_rate_client_user_unique" UNIQUE("client_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "hours_per_day" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "default_rate_unit" text DEFAULT 'hour' NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "budget_minor" integer;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "budget_currency" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "default_rate_unit" text DEFAULT 'hour' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "budget_minor" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "budget_currency" text;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "internal_cost_minor" integer;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "internal_cost_currency" text;--> statement-breakpoint
ALTER TABLE "client_member_rate" ADD CONSTRAINT "client_member_rate_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_member_rate" ADD CONSTRAINT "client_member_rate_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_member_rate" ADD CONSTRAINT "client_member_rate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_member_rate_business_id_idx" ON "client_member_rate" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "client_member_rate_client_id_idx" ON "client_member_rate" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_member_rate_user_id_idx" ON "client_member_rate" USING btree ("user_id");