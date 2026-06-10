# Server

tRPC routers and application services - the end-to-end typed API surface
between the Next.js app and the domain modules in `/modules`.

- `trpc/init.ts` - context and procedure helpers. There is no session in
  the context yet: the auth design is human-gated (ESC-3 in
  `ESCALATIONS.md`), so only `publicProcedure` exists. The protected,
  `business_id`-scoped procedure helper lands with the agreed auth design.
- `trpc/routers/` - one router per domain area, composed in `_app.ts`.
- `trpc/server.ts` - direct caller for React Server Components.
- `trpc/client.tsx` - `TRPCReactProvider` + `useTRPC` for client
  components (TanStack React Query, superjson over `/api/trpc`).

The HTTP entry point is `app/api/trpc/[trpc]/route.ts` (fetch adapter).
