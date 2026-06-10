"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TaskStatusPill, type TaskStatus } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatClock, formatDate, formatMinutes, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/server/trpc/client";

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  estimateMinutes: number | null;
};

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "in_progress", title: "In progress" },
  { id: "in_review", title: "In review" },
  { id: "done", title: "Done" },
];

const selectClassName =
  "h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

function estimateToMinutes(hoursText: string): number | null {
  if (!hoursText.trim()) {
    return null;
  }
  const hours = Number(hoursText);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return Math.round(hours * 60);
}

export function TasksPanel({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [view, setView] = useState<"board" | "list">("board");
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const refresh = () => router.refresh();
  const refreshTimer = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.time.running.queryKey(),
    });
    refresh();
  };
  const running = useQuery(trpc.time.running.queryOptions());
  const startTimer = useMutation(
    trpc.time.start.mutationOptions({ onSuccess: refreshTimer }),
  );
  const stopTimer = useMutation(
    trpc.time.stop.mutationOptions({ onSuccess: refreshTimer }),
  );
  const create = useMutation(
    trpc.tasks.create.mutationOptions({ onSuccess: refresh }),
  );
  const move = useMutation(
    trpc.tasks.setStatus.mutationOptions({ onSuccess: refresh }),
  );
  const update = useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: () => {
        setEditing(null);
        refresh();
      },
    }),
  );
  const remove = useMutation(
    trpc.tasks.delete.mutationOptions({
      onSuccess: () => {
        setEditing(null);
        refresh();
      },
    }),
  );

  function onDrop(status: TaskStatus) {
    if (dragId) {
      const current = tasks.find((t) => t.id === dragId);
      if (current && current.status !== status) {
        move.mutate({ taskId: dragId, status });
      }
      setDragId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">Tasks</h2>
        <div className="flex rounded-md border p-0.5">
          {(["board", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-sm font-medium capitalize text-muted-foreground transition-colors",
                view === mode && "bg-muted text-foreground",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((t) => t.status === column.id);
            return (
              <div
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(column.id)}
                className="flex min-h-[120px] flex-col gap-2.5 rounded-lg bg-[var(--surface-sunken)] p-2.5"
              >
                <div className="flex items-center gap-2 px-1 pt-0.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {column.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                {columnTasks.map((task) => {
                  const isRunning = running.data?.taskId === task.id;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragId(task.id)}
                      className={cn(
                        "flex cursor-grab flex-col gap-1.5 rounded-md border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm",
                        isRunning && "border-[var(--primary-border)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(task)}
                        className="text-left text-sm font-medium"
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-2">
                        {task.estimateMinutes ? (
                          <span className="text-xs text-muted-foreground tabular">
                            {formatMinutes(task.estimateMinutes)}
                          </span>
                        ) : null}
                        <span className="flex-1" />
                        {isRunning && running.data ? (
                          <RunningClock startedAt={running.data.startedAt} />
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={
                            isRunning ? "Stop timer" : "Start timer on this task"
                          }
                          disabled={startTimer.isPending || stopTimer.isPending}
                          onClick={() =>
                            isRunning
                              ? stopTimer.mutate()
                              : startTimer.mutate({ taskId: task.id })
                          }
                          className={cn(
                            "size-6 rounded-full",
                            isRunning && "text-[var(--primary-subtle-fg)]",
                          )}
                        >
                          {isRunning ? (
                            <Square className="size-3 fill-current" aria-hidden />
                          ) : (
                            <Play className="size-3.5" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <QuickAdd
                  pending={create.isPending}
                  onAdd={(title) =>
                    create.mutate({
                      projectId,
                      data: { title, status: column.id },
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tasks yet - add one on the board
            </p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setEditing(task)}
                className="flex w-full items-center gap-4 border-b px-4 py-[13px] text-left transition-colors last:border-b-0 hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {task.title}
                </span>
                {task.estimateMinutes ? (
                  <span className="shrink-0 text-sm text-muted-foreground tabular">
                    {formatMinutes(task.estimateMinutes)}
                  </span>
                ) : null}
                <TaskStatusPill status={task.status} />
              </button>
            ))
          )}
        </div>
      )}

      {editing ? (
        <EditTaskDialog
          task={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => update.mutate({ taskId: editing.id, data })}
          onDelete={() => remove.mutate({ taskId: editing.id })}
          saving={update.isPending}
          deleting={remove.isPending}
          error={update.error?.message ?? remove.error?.message ?? null}
        />
      ) : null}
    </div>
  );
}

function RunningClock({ startedAt }: { startedAt: Date | string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  return (
    <span className="font-mono text-xs font-semibold text-[var(--primary-subtle-fg)] tabular">
      {formatClock(elapsed)}
    </span>
  );
}

function QuickAdd({
  onAdd,
  pending,
}: {
  onAdd: (title: string) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) {
          onAdd(title.trim());
          setTitle("");
        }
      }}
    >
      <Input
        aria-label="Add a task"
        placeholder="Add a task"
        disabled={pending}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 border-transparent bg-transparent shadow-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:bg-card"
      />
    </form>
  );
}

function EditTaskDialog({
  task,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
  error,
}: {
  task: TaskRow;
  onClose: () => void;
  onSave: (data: {
    title: string;
    status: TaskStatus;
    estimateMinutes: number | null;
  }) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  error: string | null;
}) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [estimate, setEstimate] = useState(
    task.estimateMinutes ? String(task.estimateMinutes / 60) : "",
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              title,
              status,
              estimateMinutes: estimateToMinutes(estimate),
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={selectClassName}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="task-estimate">Estimate (hours)</Label>
              <Input
                id="task-estimate"
                type="number"
                min="0"
                step="0.25"
                placeholder="2.5"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
        <TimeSection taskId={task.id} />
      </DialogContent>
    </Dialog>
  );
}

function TimeSection({ taskId }: { taskId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const entries = useQuery(trpc.time.listForTask.queryOptions({ taskId }));
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.time.listForTask.queryKey({ taskId }),
    });
  const log = useMutation(
    trpc.time.logManual.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    trpc.time.deleteEntry.mutationOptions({ onSuccess: invalidate }),
  );

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState(true);

  const closed = (entries.data ?? []).filter((e) => e.durationSeconds !== null);
  const totalSeconds = closed.reduce(
    (sum, e) => sum + (e.durationSeconds ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">Tracked time</h3>
        {totalSeconds > 0 ? (
          <span className="text-xs text-muted-foreground tabular">
            {formatMinutes(Math.round(totalSeconds / 60))} total
          </span>
        ) : null}
      </div>

      {closed.length > 0 ? (
        <ul className="flex max-h-40 flex-col overflow-y-auto">
          {closed.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 border-b py-1.5 text-sm last:border-b-0"
            >
              <span className="text-muted-foreground">
                {formatDate(new Date(entry.startedAt))}
              </span>
              <span className="font-medium tabular">
                {formatMinutes(Math.round((entry.durationSeconds ?? 0) / 60))}
              </span>
              {entry.rateMinor != null && entry.rateCurrency ? (
                <span className="text-xs text-muted-foreground tabular">
                  {formatRate(entry.rateMinor, entry.rateCurrency)}
                </span>
              ) : null}
              {!entry.billable ? (
                <span className="rounded-full bg-[var(--status-draft-bg)] px-1.5 text-xs font-semibold text-[var(--status-draft-fg)]">
                  Non-billable
                </span>
              ) : null}
              <span className="flex-1" />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete entry"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ entryId: entry.id })}
                className="size-6"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No time tracked yet</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(hours);
          if (Number.isFinite(h) && h > 0) {
            log.mutate({
              taskId,
              startedAt: new Date(`${date}T09:00:00.000Z`),
              durationSeconds: Math.round(h * 3600),
              billable,
            });
            setHours("");
          }
        }}
        className="flex items-end gap-2"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="log-date" className="text-xs">
            Date
          </Label>
          <Input
            id="log-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex w-20 flex-col gap-1.5">
          <Label htmlFor="log-hours" className="text-xs">
            Hours
          </Label>
          <Input
            id="log-hours"
            type="number"
            min="0"
            step="any"
            required
            placeholder="1.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-8"
          />
        </div>
        <label className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
          />
          Billable
        </label>
        <Button type="submit" size="sm" disabled={log.isPending}>
          {log.isPending ? "Logging..." : "Log time"}
        </Button>
      </form>
      {log.error ? (
        <p role="alert" className="text-sm text-destructive">
          {log.error.message}
        </p>
      ) : null}
    </div>
  );
}
