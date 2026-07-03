// Displays the signed-in user's Supabase access token so they can paste it
// into Claude's custom-connector configuration and reach the remote MCP
// endpoint at /mcp.
//
// This is the Phase 1 bearer-token UX. Phase 3 replaces it with an OAuth 2.1
// authorization server so Claude does the token exchange itself.

import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CopyToken } from '@/components/mcp/CopyToken';

export const dynamic = 'force-dynamic';

export default async function McpSetupPage() {
  const sb = await getSupabaseServer();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) redirect('/login');

  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toLocaleString()
    : 'unknown';

  const connectorUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const mcpUrl = connectorUrl ? `${connectorUrl}/mcp` : '/mcp';

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Claude MCP setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the SRE expense tracker as a custom connector in Claude (web or
          mobile) so you can ask Claude to read your balances and submit
          expense reports directly.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">1. Copy your access token</h2>
        <p className="text-sm text-muted-foreground">
          This token is tied to your Supabase login. It expires at{' '}
          <span className="font-mono">{expiresAt}</span> — refresh this page
          when it stops working.
        </p>
        <CopyToken token={session.access_token} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">2. Add the connector in Claude</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>
            Open Claude → <span className="font-medium">Settings</span> →{' '}
            <span className="font-medium">Connectors</span> →{' '}
            <span className="font-medium">Add custom connector</span>.
          </li>
          <li>
            Set <span className="font-medium">Server URL</span> to:
            <pre className="mt-1 rounded bg-muted px-3 py-2 font-mono text-xs">
              {mcpUrl}
            </pre>
          </li>
          <li>
            Under <span className="font-medium">Custom headers</span>, add:
            <pre className="mt-1 rounded bg-muted px-3 py-2 font-mono text-xs">
              Authorization: Bearer &lt;paste-your-token-here&gt;
            </pre>
          </li>
          <li>Save. Claude will discover the tool list on first use.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">3. Try it</h2>
        <p className="text-sm text-muted-foreground">
          Ask Claude:{' '}
          <em>&ldquo;What&rsquo;s my current expense balance?&rdquo;</em> or{' '}
          <em>
            &ldquo;Draft an expense report for June with $1,234.56 and
            submit it.&rdquo;
          </em>
        </p>
      </section>
    </div>
  );
}
