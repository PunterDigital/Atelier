# Launch announcement - DRAFT for Shay's sign-off

Status: DRAFT. Not published anywhere. Launch material is human-led: edit freely, cut what reads wrong, publish under your own
voice when you decide the product is ready. Claims below are true as of
2026-06-11; re-verify the feature list on launch day.

---

## Hacker News (Show HN)

**Title options** (HN cuts ~80 chars; pick one)

1. Show HN: Clerq - open-source business OS for freelancers, after
   AndCo died
2. Show HN: I'm rebuilding AndCo as open source (clients, time,
   invoices)
3. Show HN: Clerq - self-hosted clients, projects, time and invoicing
   in one flow

**Body**

AndCo (later Fiverr Workspace) was the back office thousands of
freelancers ran on - proposals, time tracking, invoicing in one place.
Fiverr froze development years ago and shut it down on 1 March this
year, deleting user data. I ran my contracting business on tools like
it and got tired of the alternatives: 40-60 USD/month SaaS aimed at
wedding planners, or open-source suites that cover the features but
feel like ERP.

Clerq is an open-source (AGPL-3.0), self-hostable take on the AndCo
shape: one connected flow from client to project to tracked time to
invoice. Track time on a task, pull the unbilled hours onto an invoice
grouped how you like, issue it with a gapless number, download the PDF.

Things I cared about because I live them as a contractor:

- Cross-border invoicing done properly: multi-currency with ECB rates
  fixed per line, standard/zero-rated/EU reverse charge VAT, and the
  reverse-charge invoice refuses to issue until both VAT numbers exist
- The money math is built fixture-first against a written billing spec -
  every rounding rule has a hand-verified expected output in the repo
- Self-hosting is the first-class target: one docker compose up, no
  hosted auth dependency, seed data included
- A CSV importer with column mapping so you can walk in from AndCo
  exports, FreshBooks, or a spreadsheet

Honest status: pre-alpha. Clients, projects, kanban tasks, time
tracking, timesheets and invoicing (incl. PDF) work end to end.
Proposals, recurring invoices and payment collection do not exist yet.
The design system is in place but mid-refinement.

Repo: https://github.com/PunterDigital/Clerq

I'd genuinely value brutal feedback on the billing model - the spec and
fixtures are in the repo (BILLING-SPEC.md, fixtures/billing/).

---

## r/selfhosted

**Title:** Clerq - open-source AndCo replacement (clients, projects,
time tracking, invoicing), one docker compose up

**Body**

When Fiverr killed AndCo on 1 March and deleted everyone's data, it
made the case for self-hosting better than any blog post could. I've
been building an open-source replacement for the part of it I used
daily: the connected client -> project -> time -> invoice flow.

- AGPL-3.0, Postgres + Next.js, single container set
- docker compose up gives you migrations, seed demo data, and the app
- Email/password auth built in; Google SSO is optional via env vars,
  never required
- Multi-currency invoicing with ECB rates, EU VAT treatments, gapless
  per-year invoice numbering, PDF export
- CSV import with column mapping for getting your data in

Pre-alpha and honest about it (the README keeps a real feature status).
Would love feedback from people who run their freelance back office
self-hosted.

Repo: https://github.com/PunterDigital/Clerq

---

## Notes for launch day (not part of any post)

- Update both bodies against the README feature list before posting.
- The public repo needs the branches merged to main first - posts link
  to main.
- Plan Section 10 suggests build-in-public posts before the launch;
  these drafts assume a cold audience either way.
- If the hosted-cloud offering is live by then, mention it as "or use
  the hosted version" with pricing honesty; if not, do not preannounce.
