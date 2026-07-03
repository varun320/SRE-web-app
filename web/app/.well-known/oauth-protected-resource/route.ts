// RFC 9728 OAuth 2.0 Protected Resource Metadata.
// Tells MCP clients which OAuth authorization server to use with this
// resource. Claude discovers this URL via the WWW-Authenticate header
// returned by /mcp on a 401.

import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function origin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const iss = origin(req);
  return Response.json(
    {
      resource: `${iss}/mcp`,
      authorization_servers: [iss],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
    },
    { headers: CORS },
  );
}
