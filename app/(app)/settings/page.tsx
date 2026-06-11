import type { Metadata } from "next";

import { caller } from "@/server/trpc/server";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings - Atelier",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await caller.business.settings();
  const currentYear = new Date().getUTCFullYear();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">Settings</h1>
      <SettingsForm
        initial={settings}
        currentYear={currentYear}
      />
    </div>
  );
}
