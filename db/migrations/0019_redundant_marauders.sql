CREATE TABLE "business_suspension" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"suspended_at" timestamp with time zone NOT NULL,
	"reason" text,
	"suspended_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "platform_admin" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_suspension" (
	"user_id" text PRIMARY KEY NOT NULL,
	"suspended_at" timestamp with time zone NOT NULL,
	"reason" text,
	"suspended_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "business_suspension" ADD CONSTRAINT "business_suspension_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_suspension" ADD CONSTRAINT "business_suspension_suspended_by_user_id_user_id_fk" FOREIGN KEY ("suspended_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_suspension" ADD CONSTRAINT "user_suspension_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_suspension" ADD CONSTRAINT "user_suspension_suspended_by_user_id_user_id_fk" FOREIGN KEY ("suspended_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;