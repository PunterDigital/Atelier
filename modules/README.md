# Modules

Clerq is a modular monolith: each domain module lives here, cleanly
separated in code, shipped as one deployable. Modules own their domain
logic and expose it to `/server` (tRPC routers); they do not import from
each other's internals.

| Module      | Owns                                          | Status          |
| ----------- | --------------------------------------------- | --------------- |
| `clients`   | clients, companies, activity history           | domain + API shipped, UI pending |
| `projects`  | projects and tasks                             | projects shipped, tasks pending |
| `time`      | time tracking, timesheets                      | shipped         |
| `billing`   | invoices, currency, tax, numbering             | shipped (fixture-proven against BILLING-SPEC.md) |
| `proposals` | proposals (later phase)                        | not started     |
| `platform`  | cross-tenant stats and moderation for platform admins | shipped |

Every piece of data access is scoped by `business_id` - except `platform`,
which is the one deliberate exception: a platform admin's job is to see
across every business, not one tenant's slice of it. The billing module
is the provably-correct core: it is built test-first against
`/fixtures/billing` and nothing in it ships without a fixture.
