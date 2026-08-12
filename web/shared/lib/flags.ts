/**
 * Runtime feature flags read from env. Set on Vercel / .env.local.
 *
 * Conventions:
 *   NEXT_PUBLIC_*  → readable in the browser (client + server)
 *   no prefix      → server-only
 */

export const flags = {
  /**
   * `/admin/import` shells out to the Python `sre-import` CLI via execFile.
   * Vercel / serverless edges cannot run Python, so the surface is hidden
   * unless this flag is on. Local dev sets it to "true" in .env.local.
   * Production turns it on once a Python worker (Fly/Railway) is wired up
   * and `SRE_IMPORT_PYTHON` points at it.
   */
  importerEnabled:
    (process.env.NEXT_PUBLIC_IMPORTER_ENABLED ?? '').toLowerCase() === 'true',
} as const;
