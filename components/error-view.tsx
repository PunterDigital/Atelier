import Link from "next/link";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";

// Shared presentation for the full-page error screens (404 / 500 / root
// global-error). Deliberately dependency-free beyond the Button so it can be
// rendered from both server components (not-found) and client components
// (error boundaries). Always offers a route back to the dashboard; extra
// actions (e.g. a "Try again" reset) are passed as children.
export function ErrorView({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <p className="font-mono text-7xl font-semibold tracking-tight text-muted-foreground/40">
          {code}
        </p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Button asChild>
            <Link href="/">
              <Home aria-hidden />
              Go to dashboard
            </Link>
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
}
