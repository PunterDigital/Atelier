ALTER TABLE "time_entry" DROP CONSTRAINT "time_entry_task_id_task_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;