import type { Transition, Variants } from "framer-motion"

/** Shared cubic-bezier. Never bounce / never spring on large surfaces. */
export const easeOut = [0.16, 1, 0.3, 1] as const

export const duration = {
  instant: 0.12,
  fast: 0.2,
  base: 0.35,
  slow: 0.6,
  orb: 8,
} as const

/** `prefers-reduced-motion: reduce` — freeze shared variants. */
export const reducedMotionDuration = 0.01

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: (typeof i === "number" && Number.isFinite(i) ? i : 0) * 0.1,
      duration: duration.base,
      ease: easeOut,
    },
  }),
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.base, ease: easeOut },
  },
}

export function motionTransition(reduceMotion?: boolean | null): Transition {
  if (reduceMotion) return { duration: reducedMotionDuration }
  return { duration: duration.base, ease: easeOut }
}
