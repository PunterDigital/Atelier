CREATE TABLE "business_member_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"business_member_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"effect" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_member_permission_unique" UNIQUE("business_member_id","permission")
);
--> statement-breakpoint
ALTER TABLE "business_member_permission" ADD CONSTRAINT "business_member_permission_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_member_permission" ADD CONSTRAINT "business_member_permission_business_member_id_business_member_id_fk" FOREIGN KEY ("business_member_id") REFERENCES "public"."business_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_member_permission_member_id_idx" ON "business_member_permission" USING btree ("business_member_id");--> statement-breakpoint
CREATE INDEX "business_member_permission_business_id_idx" ON "business_member_permission" USING btree ("business_id");