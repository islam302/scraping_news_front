import { useId } from 'react';
import { motion } from 'framer-motion';

/*
 * UNA Scraper mark — derived from the UNA identity:
 *   • the crescent (UNA / OIC),
 *   • three broadcast arcs (news agencies transmitting),
 *   • a search lens inside the crescent (our job: finding & monitoring that news).
 * Drawn in currentColor so it follows the brand token of the active theme.
 */
const C = { x: 22, y: 42 }; // shared centre of crescent + arcs
const ARCS = [22, 29.5, 37];

const arcPath = (r) => `M ${C.x} ${C.y - r} A ${r} ${r} 0 0 1 ${C.x + r} ${C.y}`;

export default function Logo({ size = 36, animate = true, className = 'text-accent-green', tile = false }) {
  const maskId = useId();

  const arc = (i) =>
    animate
      ? {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: [0, 1, 1, 0.35, 1] },
          transition: {
            pathLength: { delay: 0.15 + i * 0.15, duration: 0.55, ease: 'easeOut' },
            opacity: { delay: 0.15 + i * 0.15, duration: 3.2, times: [0, 0.15, 0.6, 0.8, 1], repeat: Infinity, repeatDelay: 1.2 },
          },
        }
      : {};

  const svg = (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="UNA Scraper">
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="white" />
          <circle cx={C.x + 5.5} cy={C.y - 4.5} r="13.2" fill="black" />
        </mask>
      </defs>

      {/* Crescent */}
      <motion.circle
        cx={C.x} cy={C.y} r="17" fill="currentColor" mask={`url(#${maskId})`}
        initial={animate ? { scale: 0.6, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        style={{ transformOrigin: `${C.x}px ${C.y}px` }}
      />

      {/* Broadcast arcs */}
      {ARCS.map((r, i) => (
        <motion.path
          key={r}
          d={arcPath(r)}
          stroke="currentColor"
          strokeWidth="4.6"
          strokeLinecap="round"
          {...arc(i)}
        />
      ))}

      {/* Search lens in the crescent's hollow */}
      <motion.g
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 220, damping: 12 }}
        style={{ transformOrigin: '27px 37px' }}
      >
        <circle cx="26.5" cy="36.5" r="4.6" stroke="currentColor" strokeWidth="2.6" />
        <path d="M29.9 39.9 L33.6 43.6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </motion.g>
    </svg>
  );

  if (!tile) return svg;
  // Tile variant: mark on a soft brand square (used in compact headers)
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-accent-green/10 ring-1 ring-accent-green/15"
      style={{ width: size + 12, height: size + 12 }}
    >
      {svg}
    </span>
  );
}
