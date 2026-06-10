CREATE TABLE "time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"billable" boolean DEFAULT true NOT NULL,
	"rate_minor" integer,
	"rate_currency" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "default_rate_minor" integer;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "default_rate_currency" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "default_rate_minor" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "default_rate_currency" text;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entry_business_id_idx" ON "time_entry" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "time_entry_task_id_idx" ON "time_entry" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entry_user_id_idx" ON "time_entry" USING btree ("user_id");