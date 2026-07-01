# Server

tRPC routers and application services - the end-to-end typed API surface
between the Next.js app and the domain modules in `/modules`.

- `auth.ts` - Better Auth instance (lazy, created on first request):
  email/password always on, Google SSO only when `GOOGLE_CLIENT_ID`/
  `GOOGLE_CLIENT_SECRET` exist - self-hosting never requires a third
  party. Database sessions via the Drizzle adapter; HTTP entry at
  `app/api/auth/[...all]/route.ts`.
- `membership.ts` - resolves a user's active business (oldest membership
  until multi-entity switching lands in Phase 4).
- `updates.ts` - self-hosted update checking: compares the running build
  against the latest release published to GHCR, skipped entirely for the
  cloud instance (`BETTER_AUTH_URL` on `app.useclerq.com`).
- `trpc/init.ts` - context (resolves the Better Auth session) and the
  procedure ladder: `publicProcedure` -> `authedProcedure` (session
  required) -> `businessProcedure` (adds `ctx.businessId` derived from
  membership, never from client input - this is the tenancy boundary).
- `trpc/routers/` - one router per domain area, composed in `_app.ts`.
- `trpc/server.ts` - direct caller for React Server Components.
- `trpc/client.tsx` - `TRPCReactProvider` + `useTRPC` for client
  components (TanStack React Query, superjson over `/api/trpc`).
