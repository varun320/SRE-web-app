'use client';

// SVG sparkline that draws itself left-to-right on mount using stroke-dasharray.
// Values represent hours logged for each day of the week (Mon..Sun).

import { useEffect, useRef } from 'react';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fillGradientTop?: string;
  fillGradientBottom?: string;
  markerFill?: string;
  className?: string;
  labels?: string[];
  todayIndex?: number;
}

export function Sparkline({
  values,
  width = 320,
  height = 60,
  stroke = 'var(--hero-accent, #7cd4ff)',
  fillGradientTop = 'var(--hero-accent, #7cd4ff)',
  fillGradientBottom = 'transparent',
  markerFill = 'var(--hero-accent, #7cd4ff)',
  className,
  labels,
  todayIndex,
}: SparklineProps) {
  const pathRef = useRef<SVGPathElement | null>(null);

  const maxV = Math.max(1, ...values, 8);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const pad = 4;
  const usable = height - pad * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - pad - (v / maxV) * usable;
    return { x, y };
  });

  const linePath =
    points.length === 0
      ? ''
      : points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(' ');
  const areaPath =
    points.length === 0
      ? ''
      : `${linePath} L${width},${height} L0,${height} Z`;

  const gradientId = 'sparkline-fill';

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
    el.getBoundingClientRect(); // reflow
    el.style.transition = 'stroke-dashoffset 1200ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.strokeDashoffset = '0';
  }, [linePath]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        labels
          ? `Sparkline: ${labels
              .map((l, i) => `${l} ${values[i]?.toFixed(1) ?? '0'}h`)
              .join(', ')}`
          : `Sparkline: ${values.map((v) => v.toFixed(1)).join(', ')}`
      }
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillGradientTop} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillGradientBottom} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePath ? (
        <path
          ref={pathRef}
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {points.map((p, i) => {
        const isToday = todayIndex === i;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isToday ? 3.2 : 1.8}
            fill={isToday ? markerFill : 'currentColor'}
            fillOpacity={isToday ? 1 : 0.55}
            stroke={isToday ? 'rgba(255,255,255,0.9)' : 'none'}
            strokeWidth={isToday ? 1.2 : 0}
          >
            {isToday ? (
              <animate
                attributeName="r"
                values="3.2;4.4;3.2"
                dur="2.2s"
                repeatCount="indefinite"
              />
            ) : null}
          </circle>
        );
      })}
    </svg>
  );
}
