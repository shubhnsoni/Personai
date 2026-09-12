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
        <div className={cn("space-y-2", className)}>
            <div className="grid grid-cols-6 gap-1">
                {BLOB_COLOR_STOPS.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={item.label}
                        aria-pressed={i === index}
                        onClick={() => onChange(i)}
                        className={cn("flex flex-col items-center gap-1 rounded-lg py-1", i === index && "bg-muted/70")}
                    >
                        <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: item.hex }} />
                        <span className="text-[9px] font-medium leading-none">{item.label}</span>
                    </button>
                ))}
            </div>
            <div className="blob-color-slider" style={{ ["--slider-swatch" as string]: stop.hex }}>
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
        </div>
    )
}
