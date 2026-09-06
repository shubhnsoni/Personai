"use client"

import { useState } from "react"

const THUMB_COUNT = 4
const TONE_LABELS = ["Blue pack", "Green tone", "Violet tone", "Peach tone"] as const

function Blister({ tone }: { tone: number }) {
    return (
        <div className={`hero-art tone-${tone % THUMB_COUNT}`}>
            <div className="silhouette">
                <div className="blister" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="pill-dot" />
                    ))}
                </div>
            </div>
        </div>
    )
}

export function PdpGallery({
    photos,
    title,
    blister,
}: {
    photos: string[]
    title: string
    blister?: boolean
}) {
    const [index, setIndex] = useState(0)
    const showPhoto = photos.length > 0
    const thumbCount = showPhoto ? Math.min(photos.length, THUMB_COUNT) : blister ? THUMB_COUNT : 0
    const safeIndex = thumbCount > 0 ? Math.min(index, thumbCount - 1) : 0
    const activePhoto = showPhoto ? photos[safeIndex] : null

    return (
        <section className="gallery" aria-label="Product media">
            <div className={`hero${blister && !activePhoto ? ` tone-${safeIndex}` : ""}`}>
                {activePhoto ? (
                    <img src={activePhoto} alt={title} />
                ) : blister ? (
                    <Blister tone={safeIndex} />
                ) : (
                    <div className="hero-art" />
                )}
            </div>
            {thumbCount > 0 ? (
                <div className="thumbs" role="tablist" aria-label="Product photos">
                    {Array.from({ length: thumbCount }).map((_, i) => {
                        const src = photos[i]
                        const active = i === safeIndex
                        return (
                            <button
                                key={src || `tone-${i}`}
                                type="button"
                                role="tab"
                                className={active ? "thumb active" : "thumb"}
                                aria-label={src ? `Photo ${i + 1}` : TONE_LABELS[i] || `Tone ${i + 1}`}
                                aria-selected={active}
                                aria-pressed={active}
                                onClick={() => setIndex(i)}
                            >
                                {src ? <img src={src} alt="" /> : <div className={`thumb-fill tone-${i}`} />}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </section>
    )
}
