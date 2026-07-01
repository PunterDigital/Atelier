import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listCurrencyOptions } from "@/lib/currencies";
import { getAuth } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";
import { caller } from "@/server/trpc/server";

import { BrandingForm } from "./branding-form";
import { SettingsForm } from "./settings-form";
import { SystemAdminForm } from "./system-admin-form";

export const metadata: Metadata = {
  title: "Settings - Clerq",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await caller.business.settings();
  const currentYear = new Date().getUTCFullYear();

  // System Administration is owner/admin only (and has nothing to show on
  // the cloud instance) - fetched conditionally so the other roles who can
  // view Settings never hit the permission gate.
  const session = await getAuth().api.getSession({ headers: await headers() });
  const membership = session ? await getActiveMembership(session.user.id) : null;
  const canManageUpdates =
    membership?.permissions.has("settings.manageUpdates") ?? false;
  const systemSettings = canManageUpdates
    ? await caller.system.settings()
    : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">Settings</h1>
      <SettingsForm
        initial={settings}
        currencyOptions={listCurrencyOptions()}
        currentYear={currentYear}
      />
      <BrandingForm
        businessName={settings.name}
        initial={{
          logoDataUrl: settings.logoDataUrl,
          brandColor: settings.brandColor,
          footerNote: settings.footerNote,
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Invite people to your business and manage who has access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/settings/team">Manage team</Link>
          </Button>
        </CardContent>
      </Card>
      {systemSettings && !systemSettings.isCloudInstance ? (
        <SystemAdminForm
          initial={{
            currentVersion: systemSettings.currentVersion,
            updateChecksEnabled: systemSettings.updateChecksEnabled,
          }}
        />
      ) : null}
    </div>
  );
}
