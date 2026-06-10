# Design

Design tokens, theme, and shared UI primitives. The current baseline is
the stock shadcn/ui radix-nova preset with neutral tokens (CSS variables
in `app/globals.css`) - explicitly provisional until the human design
pass (see ESC-4 in `ESCALATIONS.md`).

The rule, from CLAUDE.md: agents implement this design system, they do
not invent taste. New screens are built from these tokens and shadcn/ui
components, never ad-hoc styles, and final aesthetic sign-off is human.
