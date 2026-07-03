// RFC 7591 Dynamic Client Registration.
// The MCP spec expects any client that discovers our AS metadata to be able
// to register itself. Supabase does the real user authentication so client
// registration here is ceremonial — we accept every request, issue a
// deterministic public client_id, and echo the requested redirect_uris.

import type { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface RegistrationRequest {
  redirect_uris?: string[];
  client_name?: string;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let body: RegistrationRequest = {};
  try {
    body = (await req.json()) as RegistrationRequest;
  } catch {
    // Empty POST body is acceptable — some clients register with no config.
  }

  const clientId = `sre-mcp-${randomBytes(6).toString('hex')}`;
  const now = Math.floor(Date.now() / 1000);

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: now,
      token_endpoint_auth_method: body.token_endpoint_auth_method ?? 'none',
      grant_types: body.grant_types ?? ['authorization_code', 'refresh_token'],
      response_types: body.response_types ?? ['code'],
      redirect_uris: body.redirect_uris ?? [],
      client_name: body.client_name ?? 'MCP client',
      scope: body.scope ?? 'mcp',
    },
    { status: 201, headers: CORS },
  );
}
