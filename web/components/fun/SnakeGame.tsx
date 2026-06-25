'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, RotateCw } from 'lucide-react';

const COLS = 20;
const ROWS = 20;
const TICK_MS = 110;
const HS_KEY = 'sre-snake-hs';

type Cell = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function randCell(blocked: readonly Cell[]): Cell {
  while (true) {
    const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!blocked.some((b) => b.x === c.x && b.y === c.y)) return c;
  }
}

interface Props {
  onClose: () => void;
}

export function SnakeGame({ onClose }: Props) {
  const [snake, setSnake] = useState<Cell[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const [food, setFood] = useState<Cell>({ x: 14, y: 10 });
  const [dir, setDir] = useState<Dir>('right');
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const queuedDir = useRef<Dir | null>(null);

  // Load high score
  useEffect(() => {
    const stored = parseInt(localStorage.getItem(HS_KEY) ?? '0', 10);
    if (!Number.isNaN(stored)) setHighScore(stored);
  }, []);

  const reset = useCallback(() => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
    setFood({ x: 14, y: 10 });
    setDir('right');
    setRunning(true);
    setGameOver(false);
    setScore(0);
    queuedDir.current = null;
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (gameOver && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reset();
        return;
      }
      const m: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right',
      };
      const next = m[e.key];
      if (!next) return;
      e.preventDefault();
      if (OPPOSITE[next] === dir) return; // no 180° flip into self
      queuedDir.current = next;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, gameOver, onClose, reset]);

  // Tick
  useEffect(() => {
    if (!running || gameOver) return;
    const id = window.setInterval(() => {
      setSnake((prev) => {
        const d = queuedDir.current ?? dir;
        queuedDir.current = null;
        if (d !== dir) setDir(d);
        const head = prev[0];
        const next: Cell = {
          x: head.x + (d === 'left' ? -1 : d === 'right' ? 1 : 0),
          y: head.y + (d === 'up' ? -1 : d === 'down' ? 1 : 0),
        };
        // Wall
        if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
          setGameOver(true);
          return prev;
        }
        // Self
        if (prev.some((c) => c.x === next.x && c.y === next.y)) {
          setGameOver(true);
          return prev;
        }
        const grew = next.x === food.x && next.y === food.y;
        const body = grew ? [next, ...prev] : [next, ...prev.slice(0, -1)];
        if (grew) {
          setScore((s) => s + 1);
          setFood(randCell(body));
        }
        return body;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, gameOver, dir, food]);

  // Persist high score
  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem(HS_KEY, String(score));
    }
  }, [gameOver, score, highScore]);

  return (
    <div
      aria-modal
      role="dialog"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] border border-[var(--color-border-soft)] p-4 space-y-3 max-w-md w-full">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              🐍 Snake <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-normal">easter egg</span>
            </h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Arrow keys or WASD · Esc to close</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="font-mono tabular-nums">
                <span className="text-[var(--color-text)]">{score}</span>
                <span className="text-[var(--color-text-muted)]"> / best {highScore}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Restart"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="relative aspect-square rounded-md bg-[var(--color-surface-2)] ring-1 ring-[var(--color-border-soft)] overflow-hidden">
          <Grid snake={snake} food={food} />
          {gameOver ? (
            <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-[2px]">
              <div className="text-center text-white space-y-2">
                <div className="text-lg font-semibold">Game over</div>
                <div className="text-xs opacity-80">Score {score}{score >= highScore && score > 0 ? ' · new best!' : ''}</div>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium hover:opacity-90"
                >
                  <RotateCw className="h-3 w-3" /> Play again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-[10px] text-[var(--color-text-muted)] text-center">
          Built by the timesheet team for tiny breaks between hours.
        </p>
      </div>
    </div>
  );
}

function Grid({ snake, food }: { snake: Cell[]; food: Cell }) {
  // Render via inline SVG for crisp pixels.
  const CELL = 100 / COLS;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <rect
        x={food.x * CELL}
        y={food.y * CELL}
        width={CELL}
        height={CELL}
        rx={CELL * 0.3}
        fill="var(--color-status-declined-fg)"
      />
      {snake.map((c, i) => (
        <rect
          key={i}
          x={c.x * CELL + 0.2}
          y={c.y * CELL + 0.2}
          width={CELL - 0.4}
          height={CELL - 0.4}
          rx={CELL * 0.25}
          fill={i === 0 ? 'var(--color-accent)' : 'var(--color-status-submitted-fg)'}
          opacity={i === 0 ? 1 : Math.max(0.45, 1 - i * 0.03)}
        />
      ))}
    </svg>
  );
}
