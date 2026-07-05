# Jobs

Background workers. Jobs fail loud - errors are surfaced (on the owning
record and in logs), never swallowed.

- `recurring-scheduler.ts` - the in-process scheduler for recurring invoices
  / retainers. Started from the root `instrumentation.ts` `register()` hook on
  server boot; ticks `modules/billing/recurring.runDueSchedules` every 15
  minutes. The timer is only a trigger - all state lives in
  `invoice_schedule.next_run_at` and each run is claimed under a row lock, so
  restarts, missed ticks and overlapping runs are all safe. The same sweep is
  reachable via `POST /api/cron/run` (token-guarded) for deployments that want
  an external scheduler instead.

Reminders are still to come.
