import type { Metadata } from "next";

import { isGoogleSsoEnabled } from "@/server/auth";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in - Clerq",
};

// Rendered per request so the Google button reflects the runtime env of
// the self-hosted instance, not whatever was set at image build time.
export const dynamic = "force-dynamic";

// Only ever redirect back into the invite flow - a whitelist that closes the
// open-redirect door while still letting an invited user land where they came
// from after authenticating.
function safeRedirect(value: string | undefined): string | undefined {
  return value && value.startsWith("/invite/") ? value : undefined;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return (
    <SignInForm
      googleEnabled={isGoogleSsoEnabled()}
      redirectTo={safeRedirect(redirect)}
    />
  );
}
