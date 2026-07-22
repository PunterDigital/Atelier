"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The three AI assistants a freelancer is most likely to use. Each entry is the
// honest, current (2026) way to point that assistant at a remote MCP server -
// none of them expose a deep link a third-party site can fire to auto-add a
// connector, so the flow is: copy the URL, open the assistant's own settings,
// paste. Where an assistant has a linkable settings page we link it; where it
// does not (or has no self-serve path at all) we say so plainly rather than
// promising a button that cannot exist.
type Provider = {
  id: string;
  name: string;
  // A short line under the tab-selected heading.
  tagline: string;
  // Optional direct link to the assistant's connector settings.
  settingsUrl?: string;
  settingsLabel?: string;
  // Ordered steps. Strings render as list items; the {url} token is replaced
  // with the copyable MCP URL styled as code.
  steps: string[];
  // An optional caveat rendered as a muted note under the steps.
  note?: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "claude",
    name: "Claude",
    tagline: "claude.ai, Claude Desktop and Cowork - full remote MCP support.",
    settingsUrl: "https://claude.ai/customize/connectors",
    settingsLabel: "Open Claude connectors",
    steps: [
      "Open Claude's connector settings (button below), or in Claude go to Settings then Connectors.",
      'Click the "+" button, then "Add custom connector".',
      "Paste the Clerq MCP URL into the remote MCP server URL field: {url}",
      'Click "Add", then "Connect" and approve the Clerq consent screen when it appears.',
    ],
    note: "Free plans allow one custom connector; Pro, Max, Team and Enterprise are unlimited. On Team/Enterprise an owner adds it under Organization settings then Connectors, and members click Connect.",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    tagline: "Custom connectors via Developer Mode (currently in beta).",
    settingsUrl: "https://chatgpt.com/",
    settingsLabel: "Open ChatGPT",
    steps: [
      "In ChatGPT, open Settings then Connectors, open Advanced settings and turn on Developer mode.",
      'Back on the Connectors screen, click "Create".',
      'Give it a name (e.g. "Clerq"), then paste the Clerq MCP URL as the server URL: {url}',
      "Choose OAuth authentication, confirm you trust the connector, and click Create - then approve the Clerq consent screen.",
    ],
    note: "Developer Mode custom connectors need a paid ChatGPT plan (Pro, Team, Enterprise or Edu) and are still rolling out. ChatGPT has no direct link to its connector settings, so open it and follow Settings then Connectors.",
  },
  {
    id: "gemini",
    name: "Gemini",
    tagline: "No self-serve custom connector in the consumer app yet.",
    steps: [
      "The consumer Gemini app does not yet let you add your own remote MCP server - its connectors are partner-only, so there is nothing to paste a URL into.",
      "If you use the Gemini CLI you can connect Clerq by adding it as an MCP server in your ~/.gemini/settings.json, pointing at: {url}",
      "Gemini Enterprise admins can add Clerq as a custom MCP server (Streamable HTTP) from the Google Cloud console.",
    ],
    note: "We're tracking Gemini's consumer connector support and will wire up a one-click flow here as soon as it exists.",
  },
];

export function ConnectAiPanel({ mcpUrl }: { mcpUrl: string }) {
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect to AI</CardTitle>
          <CardDescription>
            Let an AI assistant run your Clerq business - clients, time,
            invoices and more - through the same rules and permissions as this
            app. Point your assistant at the Clerq MCP server below, then pick
            it here for the exact steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <McpUrlField mcpUrl={mcpUrl} />
          <p className="text-sm text-muted-foreground">
            You never paste a password or token. Your assistant connects over
            OAuth and Clerq shows you a consent screen to approve first; you can
            revoke it any time.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set it up</CardTitle>
          <CardDescription>
            Choose where you want to use Clerq.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div
            role="tablist"
            aria-label="AI assistant"
            className="flex flex-wrap gap-1"
          >
            {PROVIDERS.map((p) => {
              const active = p.id === providerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                    active &&
                      "bg-[var(--primary-subtle)] font-semibold text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)] hover:text-[var(--primary-subtle-fg)]",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              {provider.name}
            </h3>
            <p className="text-sm text-muted-foreground">{provider.tagline}</p>
          </div>

          <ol className="flex flex-col gap-3">
            {provider.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="pt-px text-foreground">
                  <StepText text={step} mcpUrl={mcpUrl} />
                </span>
              </li>
            ))}
          </ol>

          {provider.settingsUrl ? (
            <div>
              <Button asChild variant="outline">
                <a
                  href={provider.settingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {provider.settingsLabel}
                  <ExternalLink data-icon="inline-end" />
                </a>
              </Button>
            </div>
          ) : null}

          {provider.note ? (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {provider.note}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// The MCP URL with a one-click copy control. The URL is the one thing every
// setup flow needs, so it gets its own prominent, copyable row.
function McpUrlField({ mcpUrl }: { mcpUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The URL is
      // still visible to select and copy by hand, so fail quietly.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        Clerq MCP server URL
      </span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
          {mcpUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={copy}
          aria-label="Copy MCP server URL"
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

// Renders a step string, swapping the {url} token for the MCP URL as inline
// code so the address stands out inside the sentence.
function StepText({ text, mcpUrl }: { text: string; mcpUrl: string }) {
  const parts = text.split("{url}");
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {mcpUrl}
      </code>
      {parts[1]}
    </>
  );
}
