import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';
import { fetchTemplatesWithTasks } from '@/features/projects/queries';
import { TemplatesList } from '@/features/projects/components/TemplatesList';

export default async function TemplatesPage() {
  const sb = await getSupabaseServer();
  const [templates, isAdmin] = await Promise.all([fetchTemplatesWithTasks(sb), fetchIsAdmin(sb)]);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <ClipboardList className="h-3.5 w-3.5" /> Templates
        </div>
        <h1 className="mt-1 text-h1">Project types</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          Set up once, reuse. When someone creates a job with a template, its full task list is auto-generated,
          staggered by phase (Pre −14d · During −6d · Post −1d) from the deadline.
          {isAdmin ? '' : ' Read-only for non-admins.'}
        </p>
      </section>

      <TemplatesList templates={templates} isAdmin={isAdmin} />
    </main>
  );
}
