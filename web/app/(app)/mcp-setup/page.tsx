// Instructions for adding the SRE expense tracker as a Claude custom
// connector. Claude drives the OAuth flow against this app's authorization
// server (/.well-known/oauth-authorization-server) — the user only needs to
// paste the URL.

import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function McpSetupPage() {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login?next=/mcp-setup');

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const hdrs = await headers();
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const host = hdrs.get('host') ?? 'localhost:3000';
  const origin = configured ?? `${proto}://${host}`;
  const mcpUrl = `${origin}/mcp`;

  return (
    <div className="w-full px-3 md:px-4 py-5 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Claude MCP setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the SRE expense tracker as a custom connector in Claude (web,
          iOS, or Android) so you can ask Claude to read your balances and
          submit expense reports directly. Claude signs you in via Supabase —
          you only paste the connector URL.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">1. Copy the connector URL</h2>
        <pre className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
          {mcpUrl}
        </pre>
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
            Set <span className="font-medium">Name</span> to something like
            &ldquo;SRE-expense&rdquo;.
          </li>
          <li>
            Paste the URL from above into <span className="font-medium">Server URL</span>.
          </li>
          <li>
            Leave <span className="font-medium">OAuth Client ID / Secret</span>{' '}
            blank — the server registers Claude dynamically.
          </li>
          <li>
            Make sure <span className="font-medium">Individual sign-in</span>{' '}
            is enabled. Save.
          </li>
          <li>
            First time you use a tool, Claude opens a browser tab and asks you
            to sign in with your SRE email. That&rsquo;s Supabase, same login
            as this app.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">3. Try it</h2>
        <p className="text-sm text-muted-foreground">
          Ask Claude:{' '}
          <em>&ldquo;What&rsquo;s my current expense balance?&rdquo;</em> or{' '}
          <em>
            &ldquo;Draft an expense report for June with $1,234.56 and submit
            it.&rdquo;
          </em>
        </p>
      </section>

      <section className="space-y-3 pt-2 border-t">
        <h2 className="text-lg font-medium">Isolation & security</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            Every request from Claude carries your personal Supabase JWT — the
            server checks it on every call, so RLS binds{' '}
            <span className="font-mono">auth.uid()</span> to you and you can
            only see your own expenses.
          </li>
          <li>
            Admin-only tools (approve, decline, unlock, record_payout) are
            hidden from your tool list unless your account has the admin role.
          </li>
          <li>
            The server never sees the service-role key. It only holds your JWT
            for the lifetime of one request.
          </li>
        </ul>
      </section>
    </div>
  );
}
