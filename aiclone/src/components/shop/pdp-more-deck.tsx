"use client"

import { useMemo, useState } from "react"

type DeckCard = {
    src: string
    alt: string
}

export function PdpMoreDeck({
    images,
    storyTitle,
    storyBody,
}: {
    images: string[]
    storyTitle: string
    storyBody: string
}) {
    const cards = useMemo<DeckCard[]>(() => {
        const base = images.filter(Boolean)
        const fallback = base[0] || "/craft/pdp-v13/ref-stacked-more.png"
        while (base.length < 3) base.push(fallback)
        return base.slice(0, 3).map((src, i) => ({
            src,
            alt: i === 0 ? "Lifestyle" : `Lifestyle ${i + 1}`,
        }))
    }, [images])

    const [front, setFront] = useState(0)
    const roles = ["front", "back-1", "back-2"] as const
    const ordered = [0, 1, 2].map((offset) => {
        const idx = (front + offset) % 3
        return { card: cards[idx], role: roles[offset], idx }
    })
    const advance = () => setFront((f) => (f + 1) % 3)

    return (
        <div className="more-row">
            <div className="more-deck" aria-label="Stacked lifestyle gallery">
                {ordered.map(({ card, role, idx }) => (
                    <button
                        key={`${card.src}-${idx}`}
                        type="button"
                        className={`deck-card ${role}`}
                        aria-label={role === "front" ? "Current lifestyle card" : `Show lifestyle card ${idx + 1}`}
                        onClick={() => (role === "front" ? advance() : setFront(idx))}
                    >
                        <img src={card.src} alt={card.alt} />
                    </button>
                ))}
                <button type="button" className="deck-more" aria-label="Show next lifestyle card" onClick={advance}>
                    MORE
                </button>
            </div>
            <div className="deck-caption">
                <h3>{storyTitle}</h3>
                <p>{storyBody}</p>
            </div>
        </div>
    )
}
