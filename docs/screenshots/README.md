# Screenshots

The images referenced from the top-level [README](../../README.md) live here.
They are real captures of the built-in demo data, taken against a fresh
instance signed in as `demo@clerq.local` / `clerq-demo`.

| File                | Screen captured                                          |
| ------------------- | ------------------------------------------------------- |
| `projects.png`      | Projects & tasks, the kanban board                      |
| `time-tracking.png` | Time tracking, the weekly timesheet                     |
| `invoice.png`       | An issued invoice with its VAT breakdown                |
| `recurring.png`     | The recurring-invoices (retainers) list                 |

## Regenerating

1. Seed a fresh instance: `pnpm db:seed`, then `pnpm exec tsx --env-file=.env
   db/seed-screenshots.ts` to add the invoices and retainers the base seed
   does not include.
2. Sign in as `demo@clerq.local` / `clerq-demo` and capture each screen at a
   **16:10** frame (these are 1600x1000 at 2x), keeping the same filenames so
   the README picks them up automatically.

Optional: drop a `demo.gif` here for an animated walkthrough and reference it
from the README.
