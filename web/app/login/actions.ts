'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const rawNext = String(formData.get('next') ?? '');
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(safeNext(rawNext));
}

function safeNext(next: string): string {
  // Only allow same-origin relative paths so we can't be turned into an
  // open redirector by an attacker crafting ?next=https://evil.example.com.
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  if (!email) return { error: 'Email is required.' };
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
