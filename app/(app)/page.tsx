import { caller } from "@/server/trpc/server";

// Per-request: session check + DB lookup, never prerenderable.
export const dynamic = "force-dynamic";

// Placeholder dashboard. The real dashboard (outstanding invoices, hours
// this week, active projects) is designed in the UI kit and lands with
// the modules that feed it.
export default async function DashboardPage() {
  const business = await caller.business.current();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl">{business.name}</h1>
      <p className="text-muted-foreground">
        You&apos;re in. Projects and time tracking are on their way - this is
        a pre-alpha instance. Start with your clients.
      </p>
    </div>
  );
}
