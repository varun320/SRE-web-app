'use client';

import { useEffect, useState } from 'react';

/**
 * CSS-only confetti burst. No deps. Mount once via fireConfetti() —
 * auto-unmounts after the animation. Respects prefers-reduced-motion.
 *
 * Usage:
 *   import { fireConfetti } from '@/components/ui/confetti';
 *   onSuccess() { fireConfetti(); }
 *
 * Plus mount <ConfettiHost /> once in the root layout.
 */

type Burst = { id: number; pieces: Piece[] };
interface Piece {
  id: number;
  color: string;
  left: number; // vw
  delay: number; // ms
  duration: number; // ms
  drift: number; // px
  rotate: number; // deg
  size: number; // px
}

const COLORS = [
  'var(--color-accent)',
  'var(--color-cat-project-border)',
  'var(--color-cat-admin-border)',
  'var(--color-cat-office-border)',
  'var(--color-status-approved-fg)',
  'var(--color-status-submitted-fg)',
];

let nextBurstId = 1;
let nextPieceId = 1;
const listeners = new Set<(b: Burst) => void>();

export function fireConfetti(count = 60): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const pieces: Piece[] = Array.from({ length: count }, () => ({
    id: nextPieceId++,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    left: Math.random() * 100,
    delay: Math.random() * 200,
    duration: 1400 + Math.random() * 1200,
    drift: (Math.random() - 0.5) * 240,
    rotate: Math.random() * 720 - 360,
    size: 6 + Math.random() * 8,
  }));

  const burst: Burst = { id: nextBurstId++, pieces };
  for (const cb of listeners) cb(burst);
}

export function ConfettiHost() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onBurst = (b: Burst) => {
      setBursts((prev) => [...prev, b]);
      // Auto-clean after the slowest piece finishes
      const maxLife = Math.max(...b.pieces.map((p) => p.delay + p.duration)) + 200;
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((x) => x.id !== b.id));
      }, maxLife);
    };
    listeners.add(onBurst);
    return () => {
      listeners.delete(onBurst);
    };
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {bursts.map((b) =>
        b.pieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-[-12px] block rounded-sm"
            style={{
              left: `${p.left}vw`,
              width: `${p.size}px`,
              height: `${p.size * 0.4}px`,
              background: p.color,
              animation: `confetti-fall ${p.duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}ms forwards`,
              ['--drift' as never]: `${p.drift}px`,
              ['--rotate' as never]: `${p.rotate}deg`,
            }}
          />
        )),
      )}
    </div>
  );
}
