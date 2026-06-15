CREATE TABLE "business_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_role_business_name_unique" UNIQUE("business_id","name")
);
--> statement-breakpoint
ALTER TABLE "business_invitation" ADD COLUMN "business_role_id" uuid;--> statement-breakpoint
ALTER TABLE "business_member" ADD COLUMN "business_role_id" uuid;--> statement-breakpoint
ALTER TABLE "business_role" ADD CONSTRAINT "business_role_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_role_business_id_idx" ON "business_role" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "business_invitation" ADD CONSTRAINT "business_invitation_business_role_id_business_role_id_fk" FOREIGN KEY ("business_role_id") REFERENCES "public"."business_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_member" ADD CONSTRAINT "business_member_business_role_id_business_role_id_fk" FOREIGN KEY ("business_role_id") REFERENCES "public"."business_role"("id") ON DELETE no action ON UPDATE no action;