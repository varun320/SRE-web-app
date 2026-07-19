/**
 * Translate raw Postgres / Supabase errors into copy a non-technical user
 * can act on. Falls back to the original message if nothing matches.
 *
 * ponytail: pattern-match on message text — Supabase JS doesn't expose
 * SQLSTATE reliably across all client versions. Add cases as they surface.
 */
export function friendlyError(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
  const msg = raw.toLowerCase();

  if (/duplicate key.*users_email_key|users_email_unique/.test(msg)) {
    return 'An employee with this email already exists.';
  }
  if (/duplicate key.*users_org_id_employee_code_key/.test(msg)) {
    return 'That employee code is already in use.';
  }
  if (/duplicate key.*positions_org_id_name_key/.test(msg)) {
    return 'A position with that name already exists.';
  }
  if (/duplicate key.*projects.*project_number/.test(msg)) {
    return 'That project number is already in use.';
  }
  if (/duplicate key/.test(msg)) {
    return 'That value is already taken — try a different one.';
  }
  if (/violates foreign key/.test(msg)) {
    return 'Referenced record is missing — reload and try again.';
  }
  if (/violates row-level security|permission denied/.test(msg)) {
    return "You don't have permission to do that.";
  }
  if (/violates check constraint/.test(msg)) {
    return 'One of the values is out of the allowed range.';
  }
  if (/jwt|invalid.*token|not authenticated|unauthenticated/.test(msg)) {
    return 'Your session expired — sign in again.';
  }
  if (/network|fetch failed|failed to fetch|econnrefused/.test(msg)) {
    return "Can't reach the server — check your connection.";
  }
  if (/invalid input syntax for type|invalid.*uuid/.test(msg)) {
    return 'One of the fields has an invalid value.';
  }

  return raw.length > 200 ? fallback : raw;
}
