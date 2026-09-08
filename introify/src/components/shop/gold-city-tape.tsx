import type { GoldTapeCity } from "@/lib/metal/board"
import { formatRatePerGram } from "@/lib/metal/math"

export function GoldCityTape({
    cities,
    wholesale = false,
    tone = "dark",
    className,
}: {
    cities: GoldTapeCity[]
    wholesale?: boolean
    tone?: "dark" | "light"
    className?: string
}) {
    if (cities.length < 2) return null
    const light = tone === "light"
    const loop = [...cities, ...cities]
    const seconds = Math.max(28, cities.length * 3.2)
    return (
        <div className={`gold-tape w-full min-w-0 max-w-full overflow-hidden ${className ?? "mt-2"}`} aria-label="Gold rates across cities">
            <div
                className="gold-tape-track flex w-max gap-5"
                style={{ animationDuration: `${seconds}s` }}
            >
                {loop.map((row, i) => (
                    <span
                        key={`${row.citySlug}-${i}`}
                        className={light
                            ? "shrink-0 text-[12px] tabular-nums text-[var(--pdp-ink)]"
                            : "shrink-0 text-[12px] tabular-nums text-foreground"}
                    >
                        <span className={light ? "text-[var(--pdp-fog)]" : "text-muted-foreground"}>{row.city}</span>
                        {" "}
                        {wholesale
                            ? `24K ${formatRatePerGram(row.k24PaisePer10g)}`
                            : `22K ${formatRatePerGram(row.k22PaisePer10g)}`}
                    </span>
                ))}
            </div>
        </div>
    )
}
