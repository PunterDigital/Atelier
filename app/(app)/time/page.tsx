import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatDate, formatMinutes } from "@/lib/format";
import { addDays, parseWeekParam, toDateKey } from "@/lib/week";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Timesheet - Atelier",
};

export const dynamic = "force-dynamic";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = parseWeekParam(week);
  const weekEnd = addDays(weekStart, 7);
  const entries = await caller.time.listMine({ from: weekStart, to: weekEnd });

  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = toDateKey(entry.startedAt);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }
  const weekSeconds = entries.reduce(
    (sum, e) => sum + (e.durationSeconds ?? 0),
    0,
  );

  const prev = toDateKey(addDays(weekStart, -7));
  const next = toDateKey(addDays(weekStart, 7));
  const isCurrentWeek = toDateKey(parseWeekParam(undefined)) === toDateKey(weekStart);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl">Timesheet</h1>
        <span className="flex-1" />
        <span className="text-sm text-muted-foreground tabular">
          {formatDate(weekStart)} - {formatDate(addDays(weekStart, 6))}
          {weekSeconds > 0
            ? ` - ${formatMinutes(Math.round(weekSeconds / 60))} tracked`
            : ""}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/time?week=${prev}`}>Previous</Link>
          </Button>
          {!isCurrentWeek ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/time">This week</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/time?week=${next}`}>Next</Link>
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <Clock className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Nothing tracked this week</h2>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            Start a timer on a task or log time from a task&apos;s dialog and
            it shows up here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dayNames.map((dayName, index) => {
            const date = addDays(weekStart, index);
            const dayEntries = byDay.get(toDateKey(date)) ?? [];
            if (dayEntries.length === 0) {
              return null;
            }
            const daySeconds = dayEntries.reduce(
              (sum, e) => sum + (e.durationSeconds ?? 0),
              0,
            );
            return (
              <section key={dayName} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2 px-1">
                  <h2 className="text-sm font-semibold">
                    {dayName}, {formatDate(date)}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular">
                    {formatMinutes(Math.round(daySeconds / 60))}
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 border-b px-4 py-[13px] last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/projects/${entry.projectId}`}
                          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {entry.taskTitle}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">
                          {entry.projectName} - {entry.clientName}
                          {entry.note ? ` - ${entry.note}` : ""}
                        </p>
                      </div>
                      {!entry.billable ? (
                        <span className="shrink-0 rounded-full bg-[var(--status-draft-bg)] px-2 py-px text-xs font-semibold text-[var(--status-draft-fg)]">
                          Non-billable
                        </span>
                      ) : null}
                      <span className="shrink-0 text-sm font-medium tabular">
                        {formatMinutes(
                          Math.round((entry.durationSeconds ?? 0) / 60),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
