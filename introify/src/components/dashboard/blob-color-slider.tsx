"use client"

import { BLOB_COLOR_STOPS, blobColorFromIndex } from "@/lib/bloub/catalog"
import { cn } from "@/lib/utils"
import "@/components/welcome-orb.css"

export function BlobColorSlider({
    index,
    onChange,
    className,
}: {
    index: number
    onChange: (index: number) => void
    className?: string
}) {
    const stop = blobColorFromIndex(index)
    const max = BLOB_COLOR_STOPS.length - 1
    const track = BLOB_COLOR_STOPS.map((item) => item.hex).join(", ")
    return (
        <div className={cn("blob-color-slider", className)} style={{ ["--slider-swatch" as string]: stop.hex }}>
            <input
                type="range"
                min={0}
                max={max}
                step={1}
                value={index}
                aria-label="Colour"
                aria-valuetext={stop.label}
                onChange={(event) => onChange(Number(event.target.value))}
                style={{ backgroundImage: `linear-gradient(90deg, ${track})` }}
            />
        </div>
    )
}
