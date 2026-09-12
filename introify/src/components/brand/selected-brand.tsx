"use client"

import { useEffect, useRef, useState } from "react"
import selection from "./selected-option.json"

const animationCache = new Map<string, Promise<string>>()
function animationSource(path: string) {
    if (!animationCache.has(path)) {
        const request = fetch(path).then(response => {
            if (!response.ok) throw new Error("Logo animation unavailable")
            return response.text()
        }).catch(error => { animationCache.delete(path); throw error })
        animationCache.set(path, request)
    }
    return animationCache.get(path)!
}

/** Option 11: one complete performance per viewport entry, then a visible rest pose. */
export function SelectedBrand({ className, decorative = false, animated = true, symbol = false }: {
    className?: string; decorative?: boolean; animated?: boolean; symbol?: boolean
}) {
    const ref = useRef<SVGSVGElement>(null)
    const [sources, setSources] = useState<string[] | null>(null)
    const finish = useRef<ReturnType<typeof setTimeout> | null>(null)
    const run = useRef(false)
    const kind = symbol ? "symbol" : "logo"
    const base = `/brand/main/introify-${kind}`

    useEffect(() => {
        const element = ref.current
        if (!animated || !element || typeof window.matchMedia !== "function" || typeof IntersectionObserver !== "function") return
        const reduced = matchMedia("(prefers-reduced-motion: reduce)")
        let disposed = false, visible = false, generation = 0
        let urls: string[] = []
        const stop = () => {
            generation++
            if (finish.current) clearTimeout(finish.current)
            finish.current = null
            run.current = false
            setSources(null)
            urls.forEach(url => URL.revokeObjectURL(url))
            urls = []
        }
        const play = async () => {
            if (disposed || reduced.matches || run.current) return
            run.current = true
            const ticket = ++generation
            try {
                const svg = await Promise.all(["light", "dark"].map(mode => animationSource(`${base}-${mode}-once.svg`)))
                if (disposed || reduced.matches || !visible || generation !== ticket) return
                // A fresh SVG document restarts reliably in each browser and logo instance.
                urls = svg.map(text => URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })))
                setSources(urls)
            } catch { if (!disposed && generation === ticket) stop() }
        }
        const observer = new IntersectionObserver(entries => {
            const entry = entries[0]
            const next = entry.isIntersecting && entry.intersectionRatio >= .25
            if (next && !visible) { visible = true; void play() }
            else if (!next && visible) { visible = false; stop() }
        }, { threshold: [0, .25] })
        observer.observe(element)
        const preference = () => { if (reduced.matches) stop() }
        reduced.addEventListener("change", preference)
        return () => {
            disposed = true
            generation++
            observer.disconnect()
            reduced.removeEventListener("change", preference)
            if (finish.current) clearTimeout(finish.current)
            finish.current = null
            run.current = false
            urls.forEach(url => URL.revokeObjectURL(url))
        }
    }, [animated, base])

    const loaded = () => {
        if (finish.current || !sources) return
        finish.current = setTimeout(() => {
            setSources(null)
            // Keep this entry consumed until the logo leaves the viewport.
        }, selection.duration * 1000)
    }
    // Match the padded source viewport: slightly smaller artwork with motion headroom.
    const width = symbol ? 260 : 940.41, height = symbol ? 260 : 302.41
    return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}
        width={width} height={height} className={className} data-brand-option={selection.option}
        data-brand-playing={Boolean(sources)} role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : "Introify"} aria-hidden={decorative || undefined} focusable="false">
        {["light", "dark"].map((mode, index) => <g key={mode}
            className={mode === "light" ? "dark:hidden [.auth-scene_&]:hidden" : "hidden dark:inline [.auth-scene_&]:inline"}>
            <image href={`${base}-${mode}-still.svg`} width={width} height={height} opacity={sources ? 0 : 1} />
            {sources && <image href={sources[index]} width={width} height={height} onLoad={loaded} />}
        </g>)}
    </svg>
}
