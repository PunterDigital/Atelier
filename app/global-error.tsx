"use client";

import { useEffect } from "react";
import { Figtree, JetBrains_Mono } from "next/font/google";
import { RotateCw } from "lucide-react";

import { ErrorView } from "@/components/error-view";
import { Button } from "@/components/ui/button";

import "./globals.css";

// Last-resort boundary for errors thrown in the root layout itself. It fully
// replaces app/layout.tsx (fonts + <html>/<body> included), so it re-declares
// the font variables the design tokens depend on. Only ever renders in
// production; in dev Next shows its error overlay instead.
const figtree = Figtree({ variable: "--font-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${figtree.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorView
          code="500"
          title="Something went wrong"
          description="An unexpected error occurred on our end. You can try again, or head back to your dashboard."
        >
          <Button variant="outline" onClick={reset}>
            <RotateCw aria-hidden />
            Try again
          </Button>
        </ErrorView>
      </body>
    </html>
  );
}
