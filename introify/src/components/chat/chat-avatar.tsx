"use client"

import { WelcomeOrb, type OrbMood } from "@/components/welcome-orb"

export function ChatAvatar({
    size,
    name,
    imageUrl,
    mode,
    colors,
    variant,
    look,
    skin,
    shape,
    expression,
    color,
    speed,
    intensity,
    gaze,
    mood,
    reactToken,
    className,
}: {
    size: number
    name: string
    imageUrl?: string | null
    mode?: string | null
    colors?: [string, string]
    variant?: string
    look?: string
    skin?: string
    shape?: string
    expression?: string
    color?: string
    speed?: number
    intensity?: number
    gaze?: { x: number; y: number } | null
    mood?: OrbMood
    reactToken?: number
    className?: string
}) {
    const showImage = mode === "IMAGE" && !!imageUrl

    if (showImage) {
        return (
            <img
                src={imageUrl}
                alt={name}
                width={size}
                height={size}
                className={className}
                style={{
                    width: size,
                    height: size,
                    borderRadius: "9999px",
                    objectFit: "cover",
                    display: "block",
                    flexShrink: 0,
                }}
            />
        )
    }

    return (
        <WelcomeOrb
            size={size}
            colors={colors}
            variant={variant}
            look={look}
            skin={skin}
            shape={shape}
            expression={expression}
            color={color}
            speed={speed || 1}
            intensity={intensity || 1}
            gaze={gaze}
            mood={mood}
            reactToken={reactToken}
            className={className}
        />
    )
}
