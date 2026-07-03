// SVG dot pattern with a radial mask so the grid fades out at the edges.
// Used as the background texture inside the WeekHero card.

interface DotPatternProps {
  className?: string;
  size?: number;
  radius?: number;
  color?: string;
}

export function DotPattern({
  className,
  size = 20,
  radius = 1.15,
  color = 'currentColor',
}: DotPatternProps) {
  const patternId = `dot-pattern-${size}-${radius}`;
  return (
    <svg
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <pattern id={patternId} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r={radius} fill={color} />
        </pattern>
        <radialGradient id={`${patternId}-mask`} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${patternId}-fade`}>
          <rect width="100%" height="100%" fill={`url(#${patternId}-mask)`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
        mask={`url(#${patternId}-fade)`}
      />
    </svg>
  );
}
