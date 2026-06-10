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

export const metadata: Metadata = {
  title: "Atelier",
  description:
    "Open-source, self-hostable business operating system for developer-freelancers: clients, projects, time tracking and invoicing in one connected flow.",
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
