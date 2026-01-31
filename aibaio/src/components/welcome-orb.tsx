"use client"

import { motion } from "framer-motion"

interface WelcomeOrbProps {
    size?: number
    colors?: [string, string]
    speed?: number
    intensity?: number
    className?: string
}

export function WelcomeOrb({
    size = 200,
    colors = ["#A855F7", "#EC4899"],
    speed = 1,
    intensity = 1,
    className,
}: WelcomeOrbProps) {
    return (
        <div
            className={className}
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
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                    filter: `blur(${20 * intensity}px)`,
                }}
                animate={{
                    scale: [1, 1.1 * intensity, 1],
                    rotate: [0, 90 * speed, 0],
                    borderRadius: [
                        "60% 40% 30% 70% / 60% 30% 70% 40%",
                        "30% 60% 70% 40% / 50% 60% 30% 60%",
                        "60% 40% 30% 70% / 60% 30% 70% 40%",
                    ],
                }}
                transition={{
                    duration: 8 / speed,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            {/* Core glow */}
            <motion.div
                style={{
                    position: "absolute",
                    width: "80%",
                    height: "80%",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)`,
                    filter: "blur(10px)",
                }}
                animate={{
                    scale: [0.8, 1, 0.8],
                    opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                    duration: 4 / speed,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        </div>
    )
}
