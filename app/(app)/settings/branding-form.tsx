"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/server/trpc/client";

const DEFAULT_BRAND_COLOR = "#228E80";
// Mirrors the server cap (~1MB source image); checked here so we can give a
// friendly message before encoding rather than after a failed mutation.
const MAX_LOGO_BYTES = 1_000_000;

export function BrandingForm({
  businessName,
  initial,
}: {
  businessName: string;
  initial: {
    logoDataUrl: string | null;
    brandColor: string | null;
    footerNote: string | null;
  };
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(
    initial.logoDataUrl,
  );
  const [brandColor, setBrandColor] = useState(
    initial.brandColor ?? DEFAULT_BRAND_COLOR,
  );
  const [footerNote, setFooterNote] = useState(initial.footerNote ?? "");
  const [logoError, setLogoError] = useState<string | null>(null);

  const update = useMutation(
    trpc.business.updateBranding.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  function onPickLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setLogoError("Logo must be a PNG or JPEG image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo is too large - keep it under ~1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.onerror = () => setLogoError("Could not read that file");
    reader.readAsDataURL(file);
  }

  const validHex = /^#[0-9a-fA-F]{6}$/.test(brandColor);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Your logo, colour and a short line - shown on every invoice PDF
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!validHex) return;
            update.mutate({
              logoDataUrl,
              brandColor: brandColor.toUpperCase(),
              footerNote: footerNote.trim() || null,
            });
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoDataUrl}
                    alt="Logo preview"
                    className="max-h-14 max-w-28 object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No logo
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  id="logo"
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => onPickLogo(e.target.files?.[0])}
                  className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-accent"
                />
                {logoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoDataUrl(null);
                      setLogoError(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              PNG or JPEG, up to ~1MB. Sits at the top-left of the invoice.
            </p>
            {logoError ? (
              <p role="alert" className="text-sm text-destructive">
                {logoError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="brandColor">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="brandColor"
                type="color"
                value={validHex ? brandColor : DEFAULT_BRAND_COLOR}
                onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                aria-label="Brand colour picker"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-32 font-mono"
                aria-label="Brand colour hex"
              />
              <button
                type="button"
                onClick={() => setBrandColor(DEFAULT_BRAND_COLOR)}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Reset
              </button>
            </div>
            {!validHex ? (
              <p role="alert" className="text-sm text-destructive">
                Use a hex colour like #228E80
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="footerNote">Invoice footer</Label>
            <textarea
              id="footerNote"
              rows={2}
              maxLength={280}
              placeholder="Thank you for your business. Payment within 30 days to GB00 BANK 1234 5678."
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              className="rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            <p className="text-sm text-muted-foreground">
              A short line printed at the foot of every invoice - payment
              terms, bank details or a thank-you. {280 - footerNote.length} left
            </p>
          </div>

          <BrandingPreview
            businessName={businessName}
            logoDataUrl={logoDataUrl}
            brandColor={validHex ? brandColor : DEFAULT_BRAND_COLOR}
            footerNote={footerNote.trim()}
          />

          {update.error ? (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message}
            </p>
          ) : null}
          {update.isSuccess ? (
            <p className="text-sm text-muted-foreground">Branding saved</p>
          ) : null}
          <div>
            <Button type="submit" disabled={update.isPending || !validHex}>
              {update.isPending ? "Saving..." : "Save branding"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// A light echo of the PDF header so the choices read before downloading one.
function BrandingPreview({
  businessName,
  logoDataUrl,
  brandColor,
  footerNote,
}: {
  businessName: string;
  logoDataUrl: string | null;
  brandColor: string;
  footerNote: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Preview</Label>
      <div className="rounded-md border bg-background p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt=""
                className="mb-1 max-h-10 max-w-36 object-contain"
              />
            ) : null}
            <span
              className="mb-[5px] text-base font-semibold"
              style={{ color: brandColor }}
            >
              {businessName}
            </span>
          </div>
          <span className="text-lg font-semibold text-foreground">Invoice</span>
        </div>
        {footerNote ? (
          <p className="mt-10 border-t pt-2 text-xs text-muted-foreground">
            {footerNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}
