import type { Metadata } from "next";

import { isGoogleSsoEnabled } from "@/server/auth";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account - Atelier",
};

// Rendered per request so the Google button reflects the runtime env of
// the self-hosted instance, not whatever was set at image build time.
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <SignUpForm googleEnabled={isGoogleSsoEnabled()} />;
}
