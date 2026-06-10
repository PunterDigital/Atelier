# Design

The Atelier design system: warm, calm, human - AndCo's friendliness with
Linear's restraint. Tokens here are the single source of truth for how
Atelier looks; components are shadcn/ui primitives styled entirely by
these tokens.

## Source

Implemented from the Atelier Design System bundle (Claude Design,
2026-06-10), supplied by Shay as the resolution of ESC-4. The bundle
(tokens, 16 component specs, dashboard/invoice/board UI kits, brand
assets, full design brief) is the design reference; ask Shay for the
archive. Key calls:

- **Primary: Soft Teal** (Shay's pick, 2026-06-10). Terracotta and coral
  ship as complete ramps in `tokens/colors.css`; switching brands is an
  alias edit, never a component restyle.
- **Type:** Figtree (UI) + JetBrains Mono (code, IDs), self-hosted at
  build time via next/font. Money and time always use tabular figures
  (`.tabular`).
- **Neutrals are warm** (taupe-tinted), shadows are soft and brown-tinted,
  corners lean rounded (inputs 9px, cards 13px, modals 18px). Cards are
  surface + 1px warm border + sm shadow + lg radius - the signature
  container.
- **Copy rules** (from the bundle): sentence case everywhere, single
  hyphens never em dashes, warm and plain-spoken, no emoji in product UI.

## Layout

- `tokens/colors.css` - ramps (terracotta/coral/teal/neutral/semantic),
  light + dark semantic aliases, invoice status-pill tokens.
- `tokens/typography.css` - scale, weights, leading, tracking, `.tabular`.
  Font families are owned by next/font in `app/layout.tsx`.
- `tokens/spacing.css` - radius, borders, elevation, motion, layout
  (244px sidebar, 60px topbar, 1180px content max).
- `app/globals.css` maps these onto the shadcn/Tailwind theme variables.

Spacing tokens are deliberately not duplicated: the system's 4px-base
scale is identical to Tailwind's built-in spacing scale - use Tailwind
utilities.

## The rule

Agents implement this system, they do not invent taste. New screens are
built from these tokens and shadcn/ui components, never ad-hoc styles,
and final aesthetic sign-off on new screens is human (CLAUDE.md
Section 1).
