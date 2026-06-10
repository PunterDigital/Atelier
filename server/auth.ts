import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb, schema } from "@/db";

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
    },
    // Google SSO is strictly optional (ESC-3): self-hosting must never
    // require a third-party account. It exists only when both env values
    // are present.
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Lazy on purpose: next build (and the Docker builder stage) imports route
// modules without a DATABASE_URL. The instance is created on first request
// and fails loud there if the env is missing.
export function getAuth() {
  auth ??= createAuth();
  return auth;
}

export function isGoogleSsoEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export type Session = ReturnType<typeof getAuth>["$Infer"]["Session"];
