import type { Metadata } from "next";

import { isGoogleSsoEnabled } from "@/server/auth";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in - Atelier",
};

// Rendered per request so the Google button reflects the runtime env of
// the self-hosted instance, not whatever was set at image build time.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <SignInForm googleEnabled={isGoogleSsoEnabled()} />;
}
