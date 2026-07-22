import type { Metadata } from "next";
import { headers } from "next/headers";

import { ConnectAiPanel } from "./connect-ai-panel";

export const metadata: Metadata = {
  title: "Connect to AI - Clerq",
};

export const dynamic = "force-dynamic";

// The MCP server is mounted at /api/mcp on this same deployment. We build the
// URL from the request headers rather than a build-time env var so a
// self-hosted instance always shows its own real address, whatever host it is
// reached on (mirrors how the MCP route derives its baseUrl per request).
export default async function ConnectAiPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "app.useclerq.net";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const mcpUrl = `${proto}://${host}/api/mcp`;

  return <ConnectAiPanel mcpUrl={mcpUrl} />;
}
