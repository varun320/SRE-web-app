'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the user hasn't moved/clicked/typed/scrolled for `ms`
 * milliseconds. Flips back to false on any activity. SSR-safe: starts false.
 *
 * Uses passive listeners + a single shared timer per call site.
 */
export function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: number;
    const reset = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
    ];
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    reset();

    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [ms]);

  return idle;
}
