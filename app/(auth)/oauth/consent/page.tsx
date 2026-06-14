import { ConsentForm } from "./consent-form";

// Where an authenticated user approves (or denies) an MCP client that is
// trying to connect to their Atelier account. The Better Auth OAuth flow
// redirects here with the client and requested scopes in the query string;
// approving posts back to the plugin's consent endpoint and returns to the
// client with an authorization code.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return (
    <ConsentForm
      clientId={first(params.client_id) ?? null}
      clientName={first(params.client_name) ?? null}
      scope={first(params.scope) ?? null}
      consentCode={first(params.consent_code) ?? null}
    />
  );
}
