# Launch claims — single source of truth

Status: reconciled 2026-07-06. This is the canonical list the launch posts draw
from. It reconciles the claims in [`docs/launch-draft.md`](launch-draft.md)
against **(a)** Shay's spec ([`clerq-software-plan.md`](../clerq-software-plan.md),
Section 6 MoSCoW) and **(b)** what is actually shipped — the 15 tRPC feature
modules ([`server/trpc/routers/_app.ts`](../server/trpc/routers/_app.ts)) and the
embedded MCP tool set ([`server/mcp/server.ts`](../server/mcp/server.ts)).

**How to use it.** Every line in §1–§2 is verified shippable and safe to claim.
Every line in §3 must **not** be claimed. §4 lists what the current draft gets
wrong and must be fixed before it can go out. §5 lists repo loose ends to close
before a launch audience starts clicking links.

The draft's own honest-status line is now **stale** — it was true as of
2026-06-11; recurring invoices, expenses and the whole AI/MCP surface have
shipped since. Re-verify against this file, not against the draft's prose.

---

## 1. Claims we can make (verified shipped)

Each bullet cites the evidence. ★ = headline-worthy.

**Core connected flow** ★
- Client → project → task → tracked time → invoice → paid, as one object graph,
  no re-keying. Modules: `clients`, `projects`, `tasks`, `time`, `invoices`.
- Clients with contacts, default rates, VAT number, and an activity thread.
- Projects and tasks with a kanban board and list views, statuses, due dates.
- Time tracking: start/stop timers, manual entries, weekly timesheet.

**Billing & money** ★
- Generate invoice lines from unbilled billable time, grouped by person+rate, by
  task, or into a single line (`invoices.generateFromTime`, `modules/billing/generate.ts`).
- Multi-currency with **ECB reference rates fixed per line** — verified: the FX
  source is the ECB v2 API (`modules/billing/fx.ts`, `source: "ecb"`).
- VAT treatments: standard / zero-rated / **EU reverse charge**. The
  reverse-charge invoice **refuses to issue until both business and client VAT
  numbers exist** (`modules/billing/tax.ts`, enforced at issue).
- Gapless, per-year sequential invoice numbering (`invoices.issue`; fixture
  `invoice-numbering.json`).
- Full invoice lifecycle: draft → sent → paid → overdue, plus void and duplicate.
- Branded PDF export (`modules/billing/pdf-data.ts`, `/api/invoices/[id]/pdf`).
- **Provably-correct money math** ★ — minor-unit integer arithmetic (floats never
  touch money), fixture-tested with hand-verified expected outputs asserted
  exactly by `pnpm test:billing`. 5 populated case files live in
  [`fixtures/billing/cases/`](../fixtures/billing/cases) (currency, rounding, tax,
  numbering, time-to-line). **Point people at `fixtures/billing/`, not
  `BILLING-SPEC.md`** — see §4.

**Recurring invoices (retainers)** ★ — *now shipped; the draft says it isn't*
- Set a schedule once (client, tax treatment, fixed-amount lines) on a cadence:
  weekly → yearly, every N periods, with net terms and an optional end date or
  occurrence cap. Clerq drafts each invoice when due and either leaves it for
  review or auto-issues. Pause/resume/end any time. Module `recurring`
  (`modules/billing/recurring.ts`, `recurrence.ts`), 8 MCP tools.
- Built-in scheduler runs the sweep (`jobs/recurring-scheduler.ts`); optional
  token-guarded `/api/cron/run` for external cron.

**Expenses** — *shipped; the draft omits it entirely*
- Capture expenses, mark paid/unpaid, attach to projects (`expenses` module/router).
- **Optional AI receipt scanning** via `GROQ_API_KEY` — reads an uploaded
  receipt (PNG/JPEG/PDF) and pre-fills the form (`modules/expenses/ocr.ts`).
  Stays hidden unless configured.

**Self-host & auth** ★
- One `docker compose up`: Postgres, migrations, seed demo data, app on :3000
  (`docker-compose.yml`). AGPL-3.0, Postgres + Next.js, single container set.
- Email/password auth built in (Better Auth); **Google SSO is strictly optional**
  via env vars, never required for self-host (`server/auth.ts`, `isGoogleSsoEnabled`).
  Server-side database sessions.

**AI & MCP** ★ — *entirely absent from the current draft; see §2 for the tool map*
- Embedded Model Context Protocol server at `/api/mcp` — nothing extra to deploy.
- 61 tools spanning clients, projects, tasks, time, invoicing, recurring,
  expenses, profit reporting and team management.
- Every tool wraps the same tRPC layer the UI uses, so validation and the
  per-business tenancy boundary are identical.
- OAuth 2.1 authorization (Better Auth) with a consent screen — no long-lived tokens.
- Signed, short-lived (15-min) invoice PDF links, usable without a browser login.

**Data portability**
- CSV **client** import with interactive column mapping
  (`app/(app)/settings/import/import-wizard.tsx`, `lib/csv.ts`) — see §3 for the
  precise scope.
- Full data export (`dataExport` router, `/api/export`, [`docs/DATA-EXPORT.md`](DATA-EXPORT.md))
  — the anti-lock-in promise is real and testable.

**Teams & multiple businesses** — *shipped; safe to feature or hold back*
- Small-team memberships with roles and permissions, scoped per business
  (`team` module, `modules/authz/`).
- One login can own/belong to several businesses with a topbar switcher.

---

## 2. Headline AI claims → MCP tool map (satisfies AC1)

Every AI claim below maps to a real tool and behaviour in
[`server/mcp/server.ts`](../server/mcp/server.ts). Tool count is **61**.

| Claim we can make | Backed by (tools) | Behaviour |
|---|---|---|
| "Run your whole business through an AI assistant" | 61 tools across 10 groups | Clients (12), projects (4), tasks (5), time (6), invoices (13), recurring (8), expenses (6), reports (1), team (4), PDF link (1), whoami (1) |
| "Track time and bill it, by voice/agent" | `start_timer`, `stop_timer`, `log_time`, `create_draft_invoice`, `generate_invoice_from_time`, `issue_invoice` | Same generate-from-unbilled-time path as the UI |
| "Set up and manage retainers via AI" | `create_recurring_invoice`, `update_recurring_invoice`, `set_recurring_invoice_status`, `generate_recurring_invoice_now` | Full retainer CRUD + on-demand generation |
| "The assistant plays by the same rules as the app" | all tools → `ClerqCaller` (tRPC) | Same validation + per-business tenancy; no side door |
| "Connect without pasting tokens" | OAuth 2.1 via Better Auth + consent screen | `/api/mcp`, no long-lived secrets |
| "Hand me a downloadable invoice" | `get_invoice_pdf_link` | 15-min signed URL, no browser login (`server/mcp/pdf-link.ts`) |
| "Optional AI receipt scanning" | `create_expense` + Groq OCR pre-fill | Gated on `GROQ_API_KEY`; off by default |

Reference for the mapping: README "AI & MCP" section and the tool registrations
in `server/mcp/server.ts`.

---

## 3. Do NOT claim — not yet shipped (satisfies AC2)

Verified absent from the codebase. Marked against Shay's MoSCoW bucket.

| Feature | Status | Spec bucket |
|---|---|---|
| Proposals (itemised, convert to project) | **Not shipped** — no router/module | Should-have |
| Contracts / e-signatures | **Not shipped** | Could-have |
| Payment collection (Stripe/other) | **Not shipped** — no Stripe/checkout anywhere | Could-have |
| Client portal | **Not shipped** | Could-have |
| Public REST API / webhooks | **Not shipped** (MCP + internal tRPC only) | Could-have |
| Reminders / dunning | **Not shipped** — only job is the recurring sweep | (implied) |
| Mobile-native app | **Not shipped** — responsive web only | Will-not-have (early) |
| Built-in accounting/ledger | **Not shipped** — by design; export instead | Will-not-have |

**Scope-precision fixes (claim narrower than the draft does):**
- **CSV import is clients-only.** The wizard maps name, contact name, contact
  email, VAT number, notes (`import-wizard.tsx` FIELDS). It does **not** import
  invoices, time, or projects. Claim "CSV **client** import with column mapping",
  not "walk in from AndCo with your data".

---

## 4. Corrections the current draft needs before it can go out

These are wrong or stale in [`docs/launch-draft.md`](launch-draft.md):

1. **"Proposals, recurring invoices and payment collection do not exist yet."**
   Recurring invoices **now ship** (see §1). Fix to: "Proposals and payment
   collection do not exist yet." Move recurring into the works-today list.
2. **`BILLING-SPEC.md` does not exist in the repo.** The draft tells readers "the
   spec and fixtures are in the repo (BILLING-SPEC.md, fixtures/billing/)". That
   file is not tracked and not on disk — and the fixture case files themselves
   cite "BILLING-SPEC.md Sections 3,4,5,7". **Either** commit the spec before
   launch **or** change every pointer to `fixtures/billing/` only. Do not ship a
   link to a missing file on HN.
3. **Expenses are unmentioned** in both the HN and r/selfhosted bodies. They ship
   (incl. optional receipt OCR). Add them.
4. **AI & MCP is entirely absent** from both bodies — the biggest missed
   headline. This is a genuine differentiator for a self-hosted freelance tool;
   the posts should lead with or prominently include it (see §2).
5. **Hosted version is live** (`app.useclerq.net`, per README). The draft's
   launch-day note says decide whether to mention it — it now exists, so make the
   call rather than leaving the placeholder.
6. **Teams / multiple-businesses / receipt OCR** are available but unmentioned —
   optional to feature, but don't say "for freelancers" in a way that implies
   single-user-only if you'd rather claim the small-studio angle too.

---

## 5. Repo loose ends to close before launch (not post copy, but linked-to)

- **`fixtures/billing/README.md` is stale/self-contradictory:** its Status
  section says "No fixture cases exist yet … blocked on the billing spec (ESC-2
  in ESCALATIONS.md)", but 5 populated, passing case files exist and there is no
  `ESCALATIONS.md`. Anyone who clicks through from the "provably-correct money
  math" claim reads that it's unbuilt. Update it.
- **Screenshots are placeholders** (`docs/screenshots/README.md`, README note).
  Swap in real captures before the README is the landing page for a launch crowd.
