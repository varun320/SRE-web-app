'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Reset link expired or invalid. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect('/');
}
