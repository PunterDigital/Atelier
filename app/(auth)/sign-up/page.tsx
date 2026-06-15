import type { Metadata } from "next";

import { isGoogleSsoEnabled } from "@/server/auth";

import { AuthShell } from "../auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account - Clerq",
};

// Rendered per request so the Google button reflects the runtime env of
// the self-hosted instance, not whatever was set at image build time.
export const dynamic = "force-dynamic";

function safeRedirect(value: string | undefined): string | undefined {
  return value && value.startsWith("/invite/") ? value : undefined;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return (
    <AuthShell>
      <SignUpForm
        googleEnabled={isGoogleSsoEnabled()}
        redirectTo={safeRedirect(redirect)}
      />
    </AuthShell>
  );
}
