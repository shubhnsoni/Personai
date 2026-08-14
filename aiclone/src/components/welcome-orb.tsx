"use client"

import { motion, useReducedMotion } from "framer-motion"
import { duration, reducedMotionDuration } from "@/lib/motion"

interface WelcomeOrbProps {
    size?: number
    colors?: [string, string]
    speed?: number
    intensity?: number
    className?: string
}

const midMorph = "30% 60% 70% 40% / 50% 60% 30% 60%"

export function WelcomeOrb({
    size = 200,
    colors = ["var(--pl-orb-from)", "var(--pl-orb-to)"],
    speed = 1,
    intensity = 1,
    className,
}: WelcomeOrbProps) {
    const reduceMotion = useReducedMotion()

    return (
        <div
            className={className}
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <motion.div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: reduceMotion ? midMorph : "50%",
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                    filter: `blur(${20 * intensity}px)`,
                }}
                animate={
                    reduceMotion
                        ? { scale: 1.1 * intensity, rotate: 90 * speed }
                        : {
                            scale: [1, 1.1 * intensity, 1],
                            rotate: [0, 90 * speed, 0],
                            borderRadius: [
                                "60% 40% 30% 70% / 60% 30% 70% 40%",
                                midMorph,
                                "60% 40% 30% 70% / 60% 30% 70% 40%",
                            ],
                        }
                }
                transition={
                    reduceMotion
                        ? { duration: reducedMotionDuration }
                        : {
                            duration: duration.orb / speed,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }
                }
            />
            {/* Core glow — tighter than the outer wash */}
            <motion.div
                style={{
                    position: "absolute",
                    width: "68%",
                    height: "68%",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 55%)`,
                    filter: "blur(8px)",
                }}
                animate={
                    reduceMotion
                        ? { scale: 1, opacity: 0.7 }
                        : {
                            scale: [0.8, 1, 0.8],
                            opacity: [0.5, 0.8, 0.5],
                        }
                }
                transition={
                    reduceMotion
                        ? { duration: reducedMotionDuration }
                        : {
                            duration: duration.orb / 2 / speed,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }
                }
            />
        </div>
    )
}
