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
    aura,
    theme,
    orbitProfile,
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
    aura?: string
    theme?: string
    orbitProfile?: boolean
    speed?: number
    intensity?: number
    gaze?: { x: number; y: number } | null
    mood?: OrbMood
    reactToken?: number
    className?: string
}) {
    const showImage = mode === "IMAGE" && !!imageUrl && !orbitProfile

    if (showImage) {
        return (
            <span
                data-chat-avatar="photo"
                className={className}
                style={{
                    width: size,
                    height: size,
                    minWidth: size,
                    minHeight: size,
                    aspectRatio: "1 / 1",
                    borderRadius: "9999px",
                    overflow: "hidden",
                    display: "block",
                    flexShrink: 0,
                    position: "relative",
                    background: "color-mix(in oklab, var(--chat-accent, #94a3b8) 18%, transparent)",
                }}
            >
                <img
                    src={imageUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center",
                        display: "block",
                    }}
                />
            </span>
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
            aura={aura}
            theme={theme}
            orbitProfile={orbitProfile}
            profileImageUrl={imageUrl}
            speed={speed || 1}
            intensity={intensity || 1}
            gaze={gaze}
            mood={mood}
            reactToken={reactToken}
            className={className}
        />
    )
}
