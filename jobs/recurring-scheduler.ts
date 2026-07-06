import "server-only";

// The in-process scheduler for recurring invoices. Next.js ships no job
// runner, so instrumentation.ts's register() hook (the framework's one
// startup seam) starts this on server boot: a plain interval that ticks
// runDueSchedules, which reads what is due straight from the database.
//
// The timer is only a trigger. All state lives in invoice_schedule.next_run_at
// and every run is claimed under a row lock, so this is robust to the things
// timers are usually fragile about: a restart catches up on the next tick, a
// missed tick just does more work on the following one, and a second replica
// (or the /api/cron/run endpoint firing at the same moment) can neither lose
// nor double a run. It relies on a long-lived process, so it is a no-op on
// serverless/edge - point an external cron at /api/cron/run there instead.

const TICK_INTERVAL_MS = 15 * 60 * 1000; // sweep every 15 minutes
const FIRST_TICK_DELAY_MS = 15 * 1000; // a first catch-up shortly after boot

let started = false;

export function startRecurringScheduler(): void {
  // register() can fire more than once across a dev hot-reload; keep one timer.
  if (started) return;
  // Escape hatch for anyone running the sweep purely via /api/cron/run.
  if (process.env.CLERQ_DISABLE_SCHEDULER === "1") return;
  // No database wired up (e.g. a build-time import) means nothing to sweep -
  // don't spin an interval whose every tick would only throw.
  if (!process.env.DATABASE_URL) return;
  started = true;

  const tick = async () => {
    try {
      const { getDb } = await import("@/db");
      const { runDueSchedules } = await import("@/modules/billing/recurring");
      const summary = await runDueSchedules(getDb());
      if (summary.invoicesGenerated > 0 || summary.errors > 0) {
        console.log(
          `[recurring] generated ${summary.invoicesGenerated}, issued ${summary.invoicesIssued}, errors ${summary.errors}`,
        );
      }
    } catch (err) {
      // Fail loud, but never let a bad sweep take the server down with it.
      console.error("[recurring] sweep failed", err);
    }
  };

  setTimeout(tick, FIRST_TICK_DELAY_MS);
  setInterval(tick, TICK_INTERVAL_MS);
}
