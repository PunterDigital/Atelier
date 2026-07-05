import type { Metadata } from "next";

import { caller } from "@/server/trpc/server";

import { BrandingForm } from "../branding-form";

export const metadata: Metadata = {
  title: "Branding - Clerq",
};

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const settings = await caller.business.settings();

  return (
    <BrandingForm
      businessName={settings.name}
      initial={{
        logoDataUrl: settings.logoDataUrl,
        brandColor: settings.brandColor,
        footerNote: settings.footerNote,
      }}
    />
  );
}
