import { getDb } from "@/db";
import { runDueSchedules } from "@/modules/billing/recurring";

// A token-guarded trigger for the recurring-invoice sweep, for deployments
// that want an external scheduler (system cron, a platform cron job) instead
// of - or alongside - the in-process ticker. It runs the exact same
// runDueSchedules the ticker does, so pointing both at it is harmless: the
// sweep is idempotent.
//
//   curl -fsS -X POST -H "Authorization: Bearer $CLERQ_CRON_TOKEN" \
//     https://your-instance/api/cron/run
//
// Disabled with a 404 until CLERQ_CRON_TOKEN is set, so it is never an open
// endpoint on a default install.

export async function POST(req: Request): Promise<Response> {
  const token = process.env.CLERQ_CRON_TOKEN;
  if (!token) {
    return new Response("Not found", { status: 404 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const summary = await runDueSchedules(getDb());
  return Response.json(summary);
}
