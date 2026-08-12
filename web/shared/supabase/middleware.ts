import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Public prefixes:
// - /login and /auth are the sign-in surface.
// - /.well-known/* serves OAuth 2.1 discovery metadata that clients read
//   before any authentication.
// - /oauth/* is the OAuth authorization server itself — /register + /token
//   are unauthenticated by design, and /authorize handles the login
//   redirect internally.
// /mcp is handled separately below (exact prefix match, not startsWith,
// so /mcp-setup stays protected).
const PUBLIC_PREFIXES = ['/login', '/auth', '/.well-known', '/oauth'];

function isPublicMcp(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

function isPublic(pathname: string): boolean {
  if (isPublicMcp(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is misconfigured, route unauthenticated users to /login instead of
  // crashing with MIDDLEWARE_INVOCATION_FAILED. Login page itself will fail to
  // actually sign in, but the user sees a real surface + we can diagnose.
  if (!url || !anon) {
    if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    return NextResponse.redirect(redirect);
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublic(request.nextUrl.pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = '/login';
      return NextResponse.redirect(redirect);
    }
    if (user && request.nextUrl.pathname === '/login') {
      const redirect = request.nextUrl.clone();
      redirect.pathname = '/';
      return NextResponse.redirect(redirect);
    }
    return response;
  } catch (e) {
    // Don't crash the edge. Log and let the request through to /login.
    console.error('[middleware] supabase auth check failed:', (e as Error).message);
    if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    return NextResponse.redirect(redirect);
  }
}
