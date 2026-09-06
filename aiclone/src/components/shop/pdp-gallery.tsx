"use client"

import { useState } from "react"

const THUMB_COUNT = 4

function Blister() {
    return (
        <div className="hero-art">
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
    const activePhoto = showPhoto ? photos[Math.min(index, photos.length - 1)] : null
    const thumbCount = showPhoto ? Math.min(photos.length, THUMB_COUNT) : blister ? THUMB_COUNT : 0

    return (
        <section className="gallery" aria-label="Product media">
            <div className="hero">
                {activePhoto ? <img src={activePhoto} alt={title} /> : blister ? <Blister /> : <div className="hero-art" />}
            </div>
            {thumbCount > 0 ? (
                <div className="thumbs">
                    {Array.from({ length: thumbCount }).map((_, i) => {
                        const src = photos[i]
                        return (
                            <button
                                key={src || `tone-${i}`}
                                type="button"
                                className={i === index ? "thumb active" : "thumb"}
                                aria-label={`Photo ${i + 1}`}
                                aria-pressed={i === index}
                                onClick={() => setIndex(i)}
                            >
                                {src ? <img src={src} alt="" /> : <div className="thumb-fill" />}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </section>
    )
}
