# Atelier billing specification

Status: **APPROVED by Shay, 2026-06-10** (sign-off below). This is the
agreed billing spec per CLAUDE.md override rule 1. Every rule here lands
with fixtures in `/fixtures/billing` that state expected outputs exactly.
A case this document does not cover gets escalated, never guessed; changes
require a new sign-off.

## 1. Money representation

- **[agreed]** All amounts are stored and computed as integers in the
  currency's minor unit (cents, pence, halere). No floats anywhere in
  billing code. Display formatting converts at the edge.
- **[agreed]** Intermediate computations (rate x hours) happen in
  arbitrary-precision decimal and are rounded to minor units only at
  defined rounding points (Section 5).

## 2. Currencies

- **[agreed]** All ISO 4217 currencies are supported as invoice and
  business base currencies.
- **[agreed]** Minor units follow ISO 4217 exactly: GBP/EUR/CZK 2
  decimals, JPY 0, BHD 3, etc.
- **[agreed]** An invoice has exactly one currency. A business has one base currency;
  invoices may be issued in any currency.

## 3. Currency conversion

- **[agreed]** FX rates come from the
  [Frankfurter API](https://frankfurter.dev) - free, keyless, ECB
  reference rates. No account required, consistent with self-hosting.
- **[agreed]** Conversion is fixed on the **invoice date**: the rate
  fetched for that date is stored on the invoice and never silently
  refreshed.
- **[agreed]** Frankfurter publishes ECB rates (~30 currencies). For
  any pair it does not cover, and as an always-available override, the
  user can enter a manual rate on the invoice. The stored rate (source:
  `ecb` or `manual`) is part of the invoice record - reproducibility
  over freshness.
- **[agreed]** Weekends/holidays: Frankfurter returns the last
  published business-day rate for a requested date; that is the rate
  used.
- **[agreed]** Conversion arithmetic: amount (minor units) x rate as
  decimal, then round half-up to the target currency's minor unit, once,
  at the final amount. Example: GBP 465.00 to EUR at 1.1734 =
  545.631 -> **EUR 545.63**.

## 4. Tax / VAT

- **[agreed]** Three treatments at launch, exactly one per invoice (no
  mixed-rate invoices):
  1. **Standard rate** - a single percentage from the business's
     `tax_config` applied to the invoice subtotal.
  2. **Zero-rated** - 0%, with the line note "Zero-rated for VAT
     purposes".
  3. **EU reverse charge** - 0%, with the mandatory note "VAT reverse
     charged to the recipient under Article 196 of Council Directive
     2006/112/EC" and both parties' VAT numbers printed.
- **[agreed]** Tax is computed on the invoice subtotal (sum of rounded
  line totals), rounded half-up to minor units once. Not per-line - with
  a single rate the results differ only in rounding, and subtotal-based
  matches how the target users' accountants reconcile.
- **[agreed]** The standard rate percentage is configuration
  (`tax_config.standardRatePct`, e.g. 21 for CZ, 20 for UK). Atelier
  never hardcodes a jurisdiction's rate and never infers which treatment
  applies - the user picks the treatment per invoice (default:
  the business's configured default treatment).
- Anything beyond these three treatments (OSS, US sales tax, mixed
  rates) is out of scope until a future spec revision.

### Worked examples (hand-verified)

| Case | Subtotal | Treatment | Tax | Total |
| ---- | -------- | --------- | --- | ----- |
| UK domestic | GBP 558.00 | standard 20% | GBP 111.60 | GBP 669.60 |
| CZ domestic | CZK 48,000.00 | standard 21% | CZK 10,080.00 | CZK 58,080.00 |
| CZ -> UK B2B | EUR 1,240.00 | reverse charge | EUR 0.00 | EUR 1,240.00 |
| Rounding edge | EUR 33.33 | standard 21% | EUR 7.00 (6.9993 rounds) | EUR 40.33 |

## 5. Rounding

- **[agreed]** Mode: **half-up** (0.5 rounds away from zero), applied
  at exactly three points:
  1. each line total (qty x unit price),
  2. the tax amount,
  3. a converted amount (Section 3).
  Sums of already-rounded values are never re-rounded.
- Example: 1h 10m at EUR 31.00/h = 70/60 x 31 = 36.1666... ->
  **EUR 36.17**.

## 6. Invoice numbering

- **[agreed]** Format: `YYYY-NNNN` (e.g. `2026-0001`), zero-padded to 4.
- **[agreed]** Scope: sequential **per business per calendar year**,
  resetting to 0001 each year. (Year-number format implies yearly reset -
  flag if you want a never-resetting sequence instead.)
- **[agreed]** Numbers are allocated inside the same database
  transaction that creates the invoice, serialized with a row lock on a
  per-business-per-year sequence row: no gaps, no duplicates, correct
  under concurrent creation. Voided invoices keep their number (a gap
  from deletion is never possible because invoices are never hard-deleted
  once numbered; drafts have no number until issued).
- **[agreed]** (Shay's review feedback) The current year's sequence
  position is configurable in business settings, so a business moving to
  Atelier mid-year can continue its existing numbering (e.g. set the next
  number to 0100). Constraint: the configured next number must be greater
  than the highest number already issued by Atelier for that business and
  year - the no-gaps/no-duplicates guarantee applies from the configured
  starting point onward, and Atelier cannot vouch for numbers issued
  outside it.
- **[agreed]** Drafts are unnumbered; the number is assigned at the
  moment an invoice is issued (draft -> sent).

## 7. Time-to-line aggregation

- **[agreed]** The user picks the grouping when generating an invoice
  from unbilled time. v1 grouping modes:
  1. **Per person and rate** (Shay's preference): one line per
     person+rate combination, quantity = summed hours, with a free-text
     description the user writes ("Shay, day rate, work across the week")
     and an optional itemised list of the covered tasks appended to the
     line description.
  2. **Per task**: one line per task, quantity = summed hours at the
     task's effective rate.
  3. **Single line**: everything on one line, quantity = total hours
     (only offered when all entries share one rate).
- **[agreed]** Rate precedence when a time entry is created:
  entry-level rate if set manually, else the project's default rate,
  else the client's default rate. The resolved rate is **stored on the
  time entry** at creation; invoicing always uses the stored rate, so
  later default changes never silently reprice old work.
- **[agreed]** Duration handling: durations are stored in seconds and
  billed exactly (hours = seconds / 3600 in decimal); no 6-minute or
  15-minute increment rounding in v1. Rounding to money happens only at
  the line total (Section 5).
- Generated lines are fully editable before issuing; editing breaks the
  link to tracked time only for removed lines (covered entries return to
  the unbilled pool).
- Worked example: entries 2h 15m + 1h 50m at GBP 62/h, per-person
  grouping = 4.0833...h x 62 = 253.1666... -> **GBP 253.17**, one line.

## 8. Out of scope for v1

Recurring invoices, partial payments, credit notes, discounts, payment
collection, and any tax treatment not listed in Section 4. Each needs a
spec revision before any code.

## Sign-off

- [X] Shay has reviewed every [proposed] item and the worked examples.

Once ticked (with corrections applied), implementation may begin,
fixture-first, per CLAUDE.md Section 6.
