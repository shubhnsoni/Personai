"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion"
import type { ItemPhoto } from "@/lib/item-photos"
import { cn } from "@/lib/utils"

const DEFAULT_LABELS: Record<ItemPhoto["source"], string> = {
    owner: "Menu",
    review: "Guest",
    auto: "More",
    google: "Google",
}

export function StoryGallery({
    photos,
    title,
    labels,
}: {
    photos: ItemPhoto[]
    title: string
    labels?: Partial<Record<ItemPhoto["source"], string>>
}) {
    const scroller = useRef<HTMLDivElement>(null)
    const box = useRef<HTMLDivElement>(null)
    const scrollX = useMotionValue(0)
    const [width, setWidth] = useState(360)

    useEffect(() => {
        const el = box.current
        if (!el) return
        const fit = () => setWidth(el.clientWidth || 360)
        fit()
        const ro = new ResizeObserver(fit)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    if (photos.length === 0) {
        return (
            <div className="flex aspect-[3/4] items-center justify-center rounded-[1.6rem] bg-zinc-900 text-sm text-zinc-500">
                No photos yet
            </div>
        )
    }

    const itemW = Math.round(width * 0.72)
    const itemH = Math.round(width * 0.96)
    const padLeft = (width - itemW) / 4
    const listPad = width - itemW

    return (
        <div ref={box} className="relative w-full" style={{ height: itemH }}>
            <div
                ref={scroller}
                className="flex h-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(e) => scrollX.set(e.currentTarget.scrollLeft)}
            >
                <div className="shrink-0 snap-none" style={{ width: padLeft }} />
                {photos.map((p, i) => (
                    <div
                        key={`${p.source}-${p.url}-${i}`}
                        className="h-full shrink-0 snap-start"
                        style={{ width: itemW }}
                    />
                ))}
                <div className="shrink-0" style={{ width: listPad - padLeft }} />
            </div>
            <div className="pointer-events-none absolute inset-0 overflow-visible">
                {photos.map((photo, i) => (
                    <StoryCard
                        key={`${photo.source}-${photo.url}-${i}`}
                        photo={photo}
                        index={i}
                        title={title}
                        itemW={itemW}
                        itemH={itemH}
                        padLeft={padLeft}
                        scrollX={scrollX}
                        count={photos.length}
                        labels={labels}
                    />
                ))}
            </div>
        </div>
    )
}

function StoryCard({
    photo,
    index,
    title,
    itemW,
    itemH,
    padLeft,
    scrollX,
    count,
    labels,
}: {
    photo: ItemPhoto
    index: number
    title: string
    itemW: number
    itemH: number
    padLeft: number
    scrollX: MotionValue<number>
    count: number
    labels?: Partial<Record<ItemPhoto["source"], string>>
}) {
    const tx = useTransform(
        scrollX,
        [(index - 2) * itemW, (index - 1) * itemW, index * itemW, (index + 1) * itemW],
        [70, 35, 0, -itemW - padLeft * 2],
    )
    const scale = useTransform(
        scrollX,
        [(index - 2) * itemW, (index - 1) * itemW, index * itemW, (index + 1) * itemW],
        [0.8, 0.9, 1, 1],
    )
    const label = labels?.[photo.source] || DEFAULT_LABELS[photo.source] || "More"

    return (
        <motion.div
            style={{
                x: tx,
                scale,
                left: padLeft,
                width: itemW,
                height: itemH,
                zIndex: count - index,
            }}
            className="absolute top-0 origin-center overflow-hidden rounded-[1.6rem] bg-zinc-900 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65)]"
        >
            <img src={photo.url} alt={title} className="h-full w-full object-cover" />
            <span
                className={cn(
                    "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] backdrop-blur",
                    photo.source === "review"
                        ? "bg-amber-300/90 text-zinc-950"
                        : photo.source === "owner"
                            ? "bg-white/90 text-zinc-950"
                            : photo.source === "google"
                                ? "bg-cyan-400/90 text-zinc-950"
                                : "bg-cyan-400/90 text-zinc-950",
                )}
            >
                {label}
            </span>
        </motion.div>
    )
}
