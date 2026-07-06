import type { Metadata } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { TRPCReactProvider } from "@/server/trpc/client";

// Self-hosted at build time by next/font - no runtime CDN dependency,
// which the design system flags as a requirement for self-hosting.
const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Absolute base for resolving OG/Twitter image URLs. The instance URL when
// set (BETTER_AUTH_URL is already the canonical origin for auth callbacks),
// falling back to the hosted app so shares still unfurl on a default build.
const siteUrl = process.env.BETTER_AUTH_URL ?? "https://app.useclerq.net";

const description =
  "Open-source, self-hostable business operating system for developer-freelancers: clients, projects, time tracking and invoicing in one connected flow.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Clerq",
  description,
  openGraph: {
    type: "website",
    siteName: "Clerq",
    title: "Clerq",
    description,
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Clerq — the open-source business OS for dev studios",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clerq",
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
