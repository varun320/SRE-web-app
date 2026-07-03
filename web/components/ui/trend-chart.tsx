'use client';

// Bars + optional line overlay on a Linear-style dark canvas.
// Used by the ledger hero cards (TIL, vacation) to show weekly movement.

import { useEffect, useRef } from 'react';

interface TrendChartProps {
  bars: number[];
  line?: number[];
  labels?: string[];
  width?: number;
  height?: number;
  barColor?: string;
  barColorNegative?: string;
  lineColor?: string;
  className?: string;
  yPad?: number;
}

export function TrendChart({
  bars,
  line,
  labels,
  width = 720,
  height = 120,
  barColor = 'var(--hero-accent, #7cd4ff)',
  barColorNegative,
  lineColor = 'rgba(255,255,255,0.9)',
  className,
  yPad = 8,
}: TrendChartProps) {
  const pathRef = useRef<SVGPathElement | null>(null);

  const usable = height - yPad * 2;
  const n = bars.length || 1;
  const gap = 4;
  const barWidth = Math.max(2, (width - gap * (n - 1)) / n - 0);

  const barMax = Math.max(0.001, ...bars.map(Math.abs));
  const lineData = line ?? [];
  const lineMax = Math.max(0.001, ...lineData);
  const lineMin = Math.min(0, ...lineData);
  const lineRange = Math.max(0.001, lineMax - lineMin);

  const barTops = bars.map((v) => {
    const h = (Math.abs(v) / barMax) * usable * 0.75;
    return {
      x: bars.indexOf(v) * (barWidth + gap),
      y: height - yPad - h,
      h,
      negative: v < 0,
    };
  });

  const linePoints = lineData.map((v, i) => {
    const x = i * (barWidth + gap) + barWidth / 2;
    const y = yPad + (1 - (v - lineMin) / lineRange) * (usable * 0.55);
    return { x, y };
  });

  const linePath =
    linePoints.length === 0
      ? ''
      : linePoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(' ');

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
      return;
    }
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 1400ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.strokeDashoffset = '0';
  }, [linePath]);

  const gradientId = 'trend-bar-fill';

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        labels
          ? `Trend: ${labels
              .map((l, i) => `${l} ${bars[i]?.toFixed(1) ?? '0'}`)
              .join(', ')}`
          : `Trend chart of ${bars.length} values`
      }
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={barColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={barColor} stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {barTops.map((b, i) => (
        <rect
          key={i}
          x={i * (barWidth + gap)}
          y={b.y}
          width={barWidth}
          height={Math.max(0, b.h)}
          rx={Math.min(2, barWidth / 3)}
          fill={b.negative && barColorNegative ? barColorNegative : `url(#${gradientId})`}
        >
          <animate
            attributeName="height"
            from="0"
            to={Math.max(0, b.h)}
            dur="800ms"
            begin={`${i * 20}ms`}
            fill="freeze"
            calcMode="spline"
            keySplines="0.22 1 0.36 1"
          />
          <animate
            attributeName="y"
            from={height - yPad}
            to={b.y}
            dur="800ms"
            begin={`${i * 20}ms`}
            fill="freeze"
            calcMode="spline"
            keySplines="0.22 1 0.36 1"
          />
        </rect>
      ))}

      {linePath ? (
        <path
          ref={pathRef}
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.75}
        />
      ) : null}
    </svg>
  );
}
