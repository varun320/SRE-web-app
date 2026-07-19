'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'sre-first-visit-hint-shown-v1';

/**
 * Fires a single onboarding toast the very first time a user loads the app
 * in this browser. Dismissible; remembered via localStorage.
 */
export function FirstVisitHint() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      return;
    }
    // Slight delay so it doesn't collide with route-change chrome.
    const t = window.setTimeout(() => {
      toast('Welcome to SRE Timesheet', {
        description: 'Tap the (?) icons anywhere for a quick tip, or the ? in the top bar for the full guide.',
        duration: 10_000,
        action: { label: 'Got it', onClick: () => {} },
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
