"use client"

import { useMemo, useRef, useState } from "react"
import { PDP_LIFESTYLE } from "@/lib/shop/pdp-content"

type DeckCard = {
    id: string
    src: string
    alt: string
    crop: string
}

const VISIBLE = 3
const CROPS = ["50% 22%", "50% 58%", "18% 42%"]
const SWIPE_PX = 56

function buildDeck(images: string[]): DeckCard[] {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const src of images) {
        if (!src || seen.has(src)) continue
        seen.add(src)
        unique.push(src)
    }
    const source = unique.length ? unique : [PDP_LIFESTYLE]
    const count = Math.max(VISIBLE, source.length)
    const cropped = source.length < VISIBLE
    return Array.from({ length: count }, (_, i) => ({
        id: `${source[i % source.length]}#${i}`,
        src: source[i % source.length],
        alt: i === 0 ? "Lifestyle" : `Lifestyle ${i + 1}`,
        crop: cropped ? CROPS[i % CROPS.length] : "50% 50%",
    }))
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
    const cards = useMemo(() => buildDeck(images), [images])
    const n = cards.length
    const [front, setFront] = useState(0)
    const [dragX, setDragX] = useState(0)
    const [dragging, setDragging] = useState(false)
    const startX = useRef<number | null>(null)
    const startY = useRef(0)
    const axis = useRef<"x" | "y" | null>(null)
    const dragXRef = useRef(0)
    const skipClick = useRef(false)

    const go = (idx: number) => {
        setFront(((idx % n) + n) % n)
        setDragX(0)
        setDragging(false)
    }
    const advance = (dir = 1) => go(front + dir)

    const visible = Array.from({ length: Math.min(VISIBLE, n) }, (_, offset) => {
        const idx = (front + offset) % n
        return { card: cards[idx], offset, idx }
    })
    const roleOf = (offset: number) => (offset === 0 ? "front" : offset === 1 ? "back-1" : "back-2")

    function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
        if (e.button !== 0) return
        startX.current = e.clientX
        startY.current = e.clientY
        axis.current = null
        setDragging(true)
    }

    function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
        if (startX.current == null) return
        const dx = e.clientX - startX.current
        const dy = e.clientY - startY.current
        if (!axis.current) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
            if (axis.current === "x") {
                try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                } catch {
                    /* jsdom */
                }
            }
        }
        if (axis.current === "x") {
            dragXRef.current = dx
            setDragX(dx)
        }
    }

    function onPointerUp() {
        const dx = dragXRef.current
        startX.current = null
        const swiped = axis.current === "x" && Math.abs(dx) >= SWIPE_PX
        axis.current = null
        dragXRef.current = 0
        if (swiped) {
            skipClick.current = true
            advance(dx < 0 ? 1 : -1)
        } else {
            setDragX(0)
            setDragging(false)
        }
    }

    return (
        <div className="more-row">
            <div className="more-deck" aria-label="Swipeable square photo stack">
                {visible.map(({ card, offset, idx }) => {
                    const frontCard = offset === 0
                    return (
                        <button
                            key={card.id}
                            type="button"
                            className={`deck-card ${roleOf(offset)}${frontCard && dragging ? " dragging" : ""}`}
                            aria-label={frontCard ? "Swipe or tap to change card" : `Show card ${idx + 1}`}
                            aria-pressed={frontCard}
                            style={
                                frontCard
                                    ? {
                                          transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)`,
                                          ["--crop" as string]: card.crop,
                                      }
                                    : { ["--crop" as string]: card.crop }
                            }
                            onPointerDown={frontCard ? onPointerDown : undefined}
                            onPointerMove={frontCard ? onPointerMove : undefined}
                            onPointerUp={frontCard ? onPointerUp : undefined}
                            onPointerCancel={frontCard ? onPointerUp : undefined}
                            onClick={() => {
                                if (skipClick.current) {
                                    skipClick.current = false
                                    return
                                }
                                if (Math.abs(dragXRef.current) >= 8) return
                                if (frontCard) advance(1)
                                else go(idx)
                            }}
                        >
                            <img src={card.src} alt={card.alt} draggable={false} />
                        </button>
                    )
                })}
                <button type="button" className="deck-more" aria-label="Show next card" onClick={() => advance(1)}>
                    MORE
                </button>
                <div className="deck-dots" role="tablist" aria-label="More details cards">
                    {cards.map((card, i) => (
                        <button
                            key={card.id}
                            type="button"
                            role="tab"
                            className={i === front ? "deck-dot active" : "deck-dot"}
                            aria-label={`Card ${i + 1}`}
                            aria-selected={i === front}
                            onClick={() => go(i)}
                        />
                    ))}
                </div>
            </div>
            <div className="deck-caption">
                <h3>{storyTitle}</h3>
                <p>{storyBody}</p>
            </div>
        </div>
    )
}
