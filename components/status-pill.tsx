import { cn } from "@/lib/utils";

// Status pills per the design system: coloured dot intent via tinted
// background + label, never emoji. Project statuses reuse the invoice
// lifecycle pill tokens with matching semantics (active = in motion,
// on hold = neutral, completed = done).
const styles = {
  active: "bg-[var(--status-sent-bg)] text-[var(--status-sent-fg)]",
  on_hold: "bg-[var(--status-draft-bg)] text-[var(--status-draft-fg)]",
  completed: "bg-[var(--status-paid-bg)] text-[var(--status-paid-fg)]",
} as const;

const labels = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
} as const;

export type ProjectStatus = keyof typeof styles;

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-px text-xs font-semibold",
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

const taskStyles = {
  todo: "bg-[var(--status-draft-bg)] text-[var(--status-draft-fg)]",
  in_progress: "bg-[var(--status-sent-bg)] text-[var(--status-sent-fg)]",
  in_review: "bg-[var(--warning-subtle)] text-[var(--warning-subtle-fg)]",
  done: "bg-[var(--status-paid-bg)] text-[var(--status-paid-fg)]",
} as const;

const taskLabels = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
} as const;

export type TaskStatus = keyof typeof taskStyles;

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-px text-xs font-semibold",
        taskStyles[status],
      )}
    >
      {taskLabels[status]}
    </span>
  );
}
