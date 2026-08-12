// Server component thin shell — forces dynamic rendering so Vercel's Linux
// packaging doesn't try to statically prerender a page that has a sibling
// server-actions module. The static prerender + co-located server actions
// produced "Unable to find lambda for route: /auth/reset-password" on
// Vercel CI (22-second install-failure), even though `next build` succeeded
// locally on both Windows and Linux.
//
// The interactive UI lives in ResetPasswordClient ('use client').
export const dynamic = 'force-dynamic';

import { ResetPasswordClient } from './ResetPasswordClient';

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
