CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"update_checks_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
