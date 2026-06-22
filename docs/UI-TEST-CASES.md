# Clerq — UI Test Cases

Manual/exploratory UI test suite, derived from driving the running app
(`pnpm dev` on `http://localhost:3210`) against the demo seed
(`demo@clerq.local` / `clerq-demo`).

- **Method:** each case was executed live in a headless browser against the
  dev server. Status reflects observed behaviour, not intended behaviour.
- **Legend:** ✅ Pass · ❌ Fail · ⚠️ Works but worth noting / minor issue ·
  ⬜ Not yet executed
- **Last run:** 2026-06-22 against seed data (Studio Demo, EUR).

## Coverage map

| Area | Routes |
| --- | --- |
| Auth | `/sign-in`, `/sign-up` |
| Onboarding | `/onboarding` |
| Dashboard | `/` |
| Clients | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` |
| Projects | `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/edit` |
| Time | `/time` |
| Invoices | `/invoices`, `/invoices/new`, `/invoices/[id]` |
| Expenses | `/expenses`, `/expenses/new`, `/expenses/[id]`, `/expenses/[id]/edit` |
| Reports | `/reports` |
| Settings | `/settings`, `/settings/team`, `/settings/import` |
| Misc | `/invite/[token]`, `/oauth/consent`, global nav, business switcher |

---

## 1. Authentication

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Sign-in required fields | Load `/sign-in`, submit empty form | Native HTML5 validation blocks submit; email & password are `required` | ✅ | Both inputs `required`, email is `type=email` |
| AUTH-02 | Sign-in wrong password | Enter valid email + wrong password, submit | Inline error, stays on `/sign-in` | ✅ | Shows "Invalid email or password" in `[role=alert]` |
| AUTH-03 | Sign-in success | Enter `demo@clerq.local` / `clerq-demo`, submit | Redirect to dashboard `/` | ✅ | Lands on dashboard, nav + greeting render |
| AUTH-04 | Unauthenticated redirect | Hit `/` while logged out | Redirect to `/sign-in` | ✅ | Confirmed on first load |

---

## 2. Clients

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| CLI-01 | List renders | Open `/clients` | Shows seeded clients, "New client", "Show archived" toggle | ✅ | 2 seed clients listed with "Added" date |
| CLI-02 | New client required name | `/clients/new`, submit empty | Name `required` blocks submit | ✅ | Name is the only required field |
| CLI-03 | Rate without currency | Enter a rate, leave currency blank, submit | Validation: "Use a three-letter currency code like EUR" | ✅ | Currency becomes required once rate is set |
| CLI-04 | Non-numeric rate message | Rate = `abc`, currency = `EUR`, submit | A clear "must be a number" style error | ⚠️ | Shows "That rate has more decimal places than EUR allows" — **misleading message for non-numeric input** |
| CLI-05 | Create client happy path | Name + rate `75` + `EUR`, submit | Client created, redirect to detail | ✅ | Redirects to `/clients/[id]`, detail renders |
| CLI-06 | Rate unit options | Inspect "Per" select | Options Hour / Day | ✅ | Default selected unit is **Day**, though Hour is listed first — minor inconsistency (CLI-12) |
| CLI-07 | Add activity note | Detail → Add note → type → submit | Note appears in activity thread with timestamp | ✅ | Thread updates inline without full reload |
| CLI-08 | Member rate validation | Save member rate with no member picked | "Pick a team member" | ✅ | |
| CLI-09 | Member rate happy path | Pick member, rate `80`, `EUR`, save | "Bills at 80.00 EUR/day" shown | ✅ | |
| CLI-10 | Edit prefills | Open `/clients/[id]/edit` | Name/rate/currency prefilled from saved values | ✅ | Rate shown normalised as `75.00` |
| CLI-11 | Archive / Restore | Detail → Archive, then Restore | Toggles archived state; archived clients hidden from list | ⚠️ | Archive is **immediate with no confirmation dialog** (reversible via Restore, so low risk) |
| CLI-12 | Member rate default unit | Save member rate leaving unit untouched | Should default to the more common unit consistently | ⚠️ | Saved as `/day` while Hour is the first option — verify intended default |
| CLI-13 | Contacts add row | "Add contact" on new form | Adds Name/Email/Role row (email is `type=email`) | ✅ | Repeatable; optional |

---

## 3. Projects

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PRJ-01 | New project required fields | `/projects/new` | Name and Client both `required` | ✅ | Status defaults to Active; Hold/Completed available |
| PRJ-02 | Client dropdown populated | Inspect client select | Lists all active clients | ✅ | Includes the just-created client; order is most-recent-first (not alphabetical) |
| PRJ-03 | Create project happy path | Name + client, Create | Redirect to project detail with Kanban board | ✅ | Board shows TO DO / IN PROGRESS / IN REVIEW / DONE |
| PRJ-04 | Inline add task | Type in a column's "+ Add a task" input, Enter | Task appears in that column, count increments | ✅ | Submits on Enter (form submit) |
| PRJ-05 | Board / List toggle | Click List, then Board | View switches; same tasks shown as rows vs cards | ✅ | |
| PRJ-06 | Open task dialog | Click a task | "Edit task" dialog: Title, Status, Estimate, Delete, Save, Tracked-time log form | ✅ | |
| PRJ-07 | Log time on task | In dialog, hours `2.5`, Log time | "2h 30m total"; shows rate (75.00 GBP/h for Lumen Labs) | ✅ | Date defaults to today; Billable checkbox defaults on; hours is `type=number` |
| PRJ-08 | Change task status | Set status In progress, Save | Card moves column; time badge shows 2:30 | ✅ | Dialog closes on save |
| PRJ-09 | Multi-currency rate | Observe task rate vs business currency | Client default currency (GBP) used even though business is EUR | ✅ | Expected multi-currency behaviour |

---

## 4. Time / Timesheet

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| TIME-01 | Timesheet renders week | Open `/time` | Current week with day groups, per-day + weekly totals | ✅ | Header "22 Jun – 28 Jun – 19h 15m tracked" |
| TIME-02 | Week navigation | Inspect Previous / Next | Links to `/time?week=YYYY-MM-DD` (±7 days) | ✅ | Prev → 06-15, Next → 06-29 |
| TIME-03 | Entry → project link | Entries link to their project | Clicking entry title navigates to project | ✅ | Each row is a project link |
| TIME-04 | Start timer from task | Project board → task play icon | Timer starts; topbar chip shows task + live clock | ✅ | aria-label "Start timer on this task" |
| TIME-05 | Topbar timer chip | While running | Chip shows task title, ticking `HH:MM:SS`, Stop button | ✅ | Chip is hidden when no timer runs |
| TIME-06 | Stop timer | Click chip Stop | Chip disappears; entry logged to the task | ✅ | Sub-minute run rounds to 0 (no visible delta) — expected |
| TIME-07 | Manual time log (task) | Task dialog → hours + Log time | Adds a tracked-time entry with rate | ✅ | Covered in PRJ-07 |

---

## 5. Invoices

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| INV-01 | New invoice form | `/invoices/new` | Client (required), full ISO currency list (required), due date, VAT treatment | ✅ | Treatment options: Standard / Zero-rated / EU reverse charge |
| INV-02 | Create draft | Pick client + currency, Create draft | Redirects to draft invoice page | ✅ | Draft badge; "Issue invoice" disabled until lines exist |
| INV-03 | Generate lines from time | "Generate lines" (group per person+rate) | Unbilled time pulled into lines, totals update | ✅ | 2 lines created, subtotal £627.75 |
| INV-04 | **Line hours/amount reconciliation** | Inspect generated line | `hours × rate` should equal the shown amount | ⚠️ | Line shows "2.50 h × £75.00/h = **£187.75**" (2.50×75=187.50). Amount uses exact tracked seconds (~2.503h) but hours are display-rounded, so they **don't reconcile on screen** |
| INV-05 | **Invalid fixed-line amount** | Add line, amount = `abc` | Friendly inline error | ✅ (fixed) | Was: raw Zod error JSON array dumped to the UI. Now shows "Enter a plain amount like 1500 or 1500.00" via the global tRPC `errorFormatter` |
| INV-06 | Add fixed line | Description + amount `500`, Add line | Line added, subtotal increases | ✅ | Subtotal → £1,127.75 |
| INV-07 | Reverse-charge issue guard | Issue with treatment=reverse charge, VAT numbers missing | Blocked with explanation | ✅ | "Reverse-charge invoices need both VAT numbers printed — add yours (in settings) and the client's (on their page)" |
| INV-08 | Issue after VAT set | Set business + client VAT, Issue | Status → Sent, gapless number assigned | ✅ | Numbered `2026-0001`; issue date shown; "it cannot be undone" warning present |
| INV-09 | **Download PDF** | Click Download PDF / fetch endpoint | Valid PDF returned for the invoice | ✅ | `GET /api/invoices/[id]/pdf` → 200, `application/pdf`, `attachment; filename="invoice-2026-0001.pdf"`, valid `%PDF-1.3`, 1 page. Saved to `docs/test-artifacts/` |
| INV-10 | Mark as paid | Click Mark as paid | Status → Paid, action removed | ✅ | PDF still downloadable |
| INV-11 | Invoices list | `/invoices` | Lists invoice with number, status, client, total | ✅ | Shows 2026-0001 · Paid · £1,127.75 |
| INV-12 | Group-as / project filters | Inspect "Group as" + Project selects | Options for per-person, per-task, single line; project filter | ✅ | Present; only per-person-rate exercised |

---

## 6. Expenses

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| EXP-01 | New expense form | `/expenses/new` | Description, amount, currency, date all `required`; vendor/category/receipt/notes optional | ✅ | Date defaults to today; currency defaults EUR; receipt is `type=file` |
| EXP-02 | Invalid amount | Amount = `abc`, submit | Clean inline error | ✅ | "Enter a valid amount for EUR (e.g. 49.99)" — **handled correctly here** (contrast with INV-05) |
| EXP-03 | Create expense | Valid fields, Add expense | Redirect to expense detail | ✅ | Shows Unpaid, €125.50, vendor, category |
| EXP-04 | Mark paid / unpaid | Toggle on detail | Status flips; button label toggles | ✅ | Paid ↔ Unpaid both directions |
| EXP-05 | List + status filter | `/expenses`, click Unpaid | Filter narrows list; empty state when none | ✅ | `?status=unpaid` → "No unpaid expenses" empty state with CTA |
| EXP-06 | Edit prefills | `/expenses/[id]/edit` | All fields prefilled | ✅ | |
| EXP-07 | Delete from UI | Look for delete control | — | ⚠️ | **No Delete in the UI** (detail or edit); deletion only via API/MCP. Confirm if intended |

---

## 7. Reports

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| REP-01 | Profit report renders | `/reports` | Cash + Accrued profit, per-currency, no conversion | ✅ | Explanatory copy for each basis |
| REP-02 | Figures reconcile | Compare to created data | Reflects paid GBP invoice + paid EUR expense | ✅ | GBP income £1,127.75; EUR expenses −€125.50; profit lines correct |
| REP-03 | Per-currency separation | Inspect EUR vs GBP blocks | Each currency totalled separately | ✅ | No cross-currency mixing |
| REP-04 | Budget report | Look for budget section | — | ⬜ | Not shown (no client/project budgets set this run); revisit with budgets configured |

---

## 8. Settings (Team & Import)

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| SET-01 | Business settings save | `/settings`, set VAT rate, VAT number, address, Save | Values persist | ✅ | Used to satisfy reverse-charge issuing (INV-08) |
| SET-02 | Settings fields present | Inspect `/settings` | Name, address, base currency, VAT rate, hours/day, VAT number, next invoice number, branding (logo/colour/footer) | ✅ | Branding has colour picker + hex + file logo + footer note |
| SET-03 | Team page renders | `/settings/team` | Invite form (7 roles + descriptions), members list, custom roles | ✅ | Roles: Owner/Admin/Manager/Member/Accountant/Contractor/Viewer |
| SET-04 | Create invite | Email + role, Create invite | Pending invite with Copy link / Revoke, 7-day expiry | ✅ | "expires 29 Jun" |
| SET-05 | Invite acceptance (valid) | Open `/invite/[token]` | "Join Studio Demo as a member" + Join button | ✅ | Not accepted (tester is already owner) |
| SET-06 | Invite acceptance (invalid) | Open `/invite/bad-token` | Friendly not-found message | ✅ | "Invite not found … Ask whoever invited you for a fresh one." |
| SET-07 | CSV import — paste & map | `/settings/import`, paste CSV | Step 2 mapping with auto-detected columns; step 3 preview | ✅ | Auto-mapped name→Company, VAT→VAT; "2 data rows found" |
| SET-08 | CSV import — execute | Click Import | Clients created; dedupe on existing names | ✅ | Acme + Beta appear in list; **no explicit success toast** shown (minor) |

---

## 9. Navigation, shell & misc

| ID | Case | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| NAV-01 | Sidebar navigation | Visit each nav item | All sections load (Dashboard/Clients/Projects/Timesheet/Invoices/Expenses/Reports/Settings) | ✅ | All routes reachable |
| NAV-02 | Dashboard aggregates | `/` after creating data | Cards reflect live data; recent invoices + activity feed accurate | ✅ | Unbilled time dropped after billing; paid invoice + activity shown |
| NAV-03 | Business switcher | Open switcher | Lists businesses; current marked; "Create business" | ✅ | |
| NAV-04 | Create business | Switcher → Create business → name + currency | New business created and switched to | ✅ | Switched to "Test Studio Two" |
| NAV-05 | Per-business data isolation | After switching | New business has its own empty data | ✅ | "No clients yet" in the new business |
| NAV-06 | Switch back | Re-open switcher, pick original | Returns to Studio Demo with its data | ✅ | |
| NAV-07 | 404 unknown route | Visit `/this-route-does-not-exist` | Friendly 404 | ✅ | "404 — This page could not be found." |
| NAV-08 | Sign-up form | `/sign-up` | Name/email/password, all required | ✅ | Auth pages reachable even when logged in (no redirect — minor) |
| NAV-09 | Sign-up validation | Submit with password `123` | Rejected, no account created | ✅ | "Password too short"; stays on page |
| NAV-10 | Onboarding redirect | `/onboarding` while having a business | Redirect to dashboard | ✅ | |
| NAV-11 | OAuth consent page | `/oauth/consent` | Renders Authorize/Deny consent screen | ✅ | Renders generic consent even without params |
| NAV-12 | **Currency dropdown hydration** | Load `/invoices/new` or `/settings` | No hydration error | ✅ (fixed) | Was: React hydration mismatch in `CurrencySelect` from server/browser ICU label skew. Now the option list is computed once on the server (`lib/currencies.ts`) and passed as a prop; re-verified both pages with no hydration errors in console or server logs |
| NAV-13 | Sign out | Topbar → Sign out | Session cleared, redirect to sign-in | ✅ | See AUTH; confirmed at end of run |

---

## Bugs & issues summary

Ranked by severity, with the test case that surfaced each.

### ❌ Confirmed bugs — both now FIXED ✅ (verified live + full quality gate)
1. **Hydration mismatch in the currency dropdown** (NAV-12) — `components/currency-select.tsx`
   builds its `<option>` list from `Intl.supportedValuesOf("currency")` +
   `Intl.DisplayNames`, which resolve differently on the Node server vs the
   browser (ICU version skew; e.g. the `SLL` code's label). React logs
   "Hydration failed… server rendered text didn't match the client" and
   regenerates the subtree. Affects every page with a `CurrencySelect`
   (`/invoices/new`, `/settings`). *Fix idea:* compute the option list once on
   the server and pass it down as a prop, or pin a single source of currency
   labels so server and client are identical.
   **Fixed:** `lib/currencies.ts` (`server-only`) builds the list; pages pass it
   to `CurrencySelect` as a prop.
2. **Raw Zod error dumped to the UI** (INV-05) — adding an invoice line with a
   non-numeric amount renders the entire `ZodError` JSON array on screen instead
   of the friendly `message`. The expense form handles the same input cleanly
   (EXP-02), so the fix is localised to the invoice add-line error handling.
   **Fixed:** a tRPC `errorFormatter` in `server/trpc/init.ts` surfaces the first
   Zod issue's message (and exposes `data.zodError` for field-level detail),
   fixing this class of leak app-wide.

### ⚠️ Worth a look
3. **Line hours don't reconcile with the amount** (INV-04) — a generated line
   reads "2.50 h × £75.00/h = £187.75" (2.50 × 75 = 187.50). The amount is
   computed from exact tracked seconds while the hours are display-rounded, so
   the on-screen multiplication looks wrong to a client reading the invoice.
4. **Misleading rate validation message** (CLI-04) — a non-numeric default rate
   reports "more decimal places than EUR allows" rather than "must be a number".
5. **No delete for expenses in the UI** (EXP-07) — deletion exists in the API/MCP
   but there's no UI control on the expense detail or edit page.
6. **Archive has no confirmation** (CLI-11) — client archive is immediate;
   low-risk because it's reversible via Restore.
7. **No success confirmation after CSV import** (SET-08) — import works but gives
   no explicit "N clients imported" feedback.
8. **Member-rate default unit** (CLI-12) — saves as `/day` while "Hour" is the
   first option in the select.
9. **Auth pages don't redirect logged-in users** (NAV-08) — `/sign-in` and
   `/sign-up` render their forms even with an active session.

### ✅ Things that are notably well done
- Reverse-charge invoices are correctly blocked until both VAT numbers exist (INV-07).
- Invoice PDF export is a real, valid, correctly-named PDF (INV-09).
- Per-business data isolation is clean (NAV-05); per-currency reports never mix
  currencies (REP-03).
- Money math uses exact tracked time rather than rounded hours (the cause of
  INV-04 is precision, not sloppiness).

---

## Environment & how to reproduce this run

- App: `pnpm dev -p 3210` (via `.claude/launch.json` → preview), seed
  `demo@clerq.local` / `clerq-demo`.
- **Database note:** the repo `.env` points `DATABASE_URL` at
  `localhost:5432`, but on this machine port 5432 is held by an unrelated
  `quest-tracker-db` container (the `clerq` role fails auth there). For this run
  the DB was temporarily pointed at `localhost:5433` (the running
  `clerq-e2e-pg` container, which had an empty `clerq` database), then
  `pnpm db:migrate` + `pnpm db:seed` were run against it. `.env` was restored
  afterwards. To re-run these tests, start a Postgres with role/db `clerq` and
  point `DATABASE_URL` at it (or reuse 5433).
- Artifacts: `docs/test-artifacts/invoice-2026-0001.pdf` (the exported invoice).
- Not exercised this run: file uploads (logo, expense receipt), Google SSO,
  drag-and-drop task reordering on the board, budget report (no budgets set),
  full invite acceptance (tester was already the owner).
