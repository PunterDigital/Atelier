# Modules

Atelier is a modular monolith: each domain module lives here, cleanly
separated in code, shipped as one deployable. Modules own their domain
logic and expose it to `/server` (tRPC routers); they do not import from
each other's internals.

| Module      | Owns                                          | Status          |
| ----------- | --------------------------------------------- | --------------- |
| `clients`   | clients, companies, activity history           | domain + API shipped, UI pending |
| `projects`  | projects and tasks                             | projects shipped, tasks pending |
| `time`      | time tracking, timesheets                      | tracking shipped, timesheet pending |
| `billing`   | invoices, currency, tax, numbering             | money core started (spec approved) |
| `proposals` | proposals (later phase)                        | not started     |

Every piece of data access is scoped by `business_id`. The billing module
is the provably-correct core: it is built test-first against
`/fixtures/billing` and nothing in it ships without a fixture.
