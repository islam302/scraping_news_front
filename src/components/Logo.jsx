import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function Logo({ size = 36, animate = true, variant }) {
  const { isDark } = useTheme();
  // variant: 'sidebar' uses white on green bg, 'brand' uses green on any bg
  const color = variant === 'brand'
    ? (isDark ? '#c8f542' : '#1B6B3A')
    : (isDark ? '#c8f542' : '#ffffff');
  const bgOpacity = isDark ? 0.1 : 0.15;

  const arcVariants = animate
    ? {
        hidden: { pathLength: 0, opacity: 0 },
        visible: (i) => ({
          pathLength: 1, opacity: 1,
          transition: { delay: 0.2 + i * 0.15, duration: 0.6, ease: 'easeOut' },
        }),
      }
    : { hidden: { pathLength: 1, opacity: 1 }, visible: { pathLength: 1, opacity: 1 } };

  const dotVariants = animate
    ? { hidden: { scale: 0 }, visible: { scale: 1, transition: { delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 } } }
    : { hidden: { scale: 1 }, visible: { scale: 1 } };

  const boltVariants = animate
    ? { hidden: { opacity: 0, y: -4 }, visible: { opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.4 } } }
    : { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } };

  return (
    <motion.svg width={size} height={size} viewBox="0 0 36 36" fill="none" initial="hidden" animate="visible">
      <circle cx="18" cy="18" r="17" fill={color} fillOpacity={bgOpacity} />

      {[12, 9, 6].map((arcR, i) => (
        <motion.path
          key={i}
          d={`M ${18 - arcR} 18 A ${arcR} ${arcR} 0 0 1 18 ${18 - arcR}`}
          stroke={color} strokeWidth={size * 0.055} strokeLinecap="round" fill="none"
          custom={i} variants={arcVariants}
        />
      ))}

      <motion.circle cx="18" cy="18" r="2.2" fill={color} variants={dotVariants} />

      <motion.path
        d="M25 10l-2 4h3l-2 4"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        variants={boltVariants}
      />

      {animate && (
        <motion.circle
          cx="18" cy="18" r="15" stroke={color} strokeWidth="0.5" fill="none"
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: '18px 18px' }}
        />
      )}
    </motion.svg>
  );
}
