"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, ChevronLeft, ChevronRight, RotateCcw, Sparkles, X } from "lucide-react"
import { dietLabel } from "@/lib/menu"
import { createArEngine, type ArEngine, type ArMode } from "@/lib/ar-engine"
import {
    detectArLaunch,
    isPubliclyReachable,
    quickLookHref,
    sceneViewerHref,
    type ArLaunch,
} from "@/lib/ar-platform"

export type ArMenuDish = {
    id: string
    title: string
    subtitle?: string | null
    description?: string | null
    priceLabel: string
    diet?: string | null
    spiceLevel?: number | null
    serve?: string | null
    ready: string
    /** meshopt-compressed model for the in-page viewer */
    glb: string
    /** plain-glTF twin at real scale, for Google Scene Viewer */
    glbAr?: string | null
    /** real-scale USDZ, for iOS AR Quick Look */
    usdz?: string | null
    sizeMeters?: number
    /** mean of real OfferReview rows; null when nothing has been reviewed */
    rating?: number | null
    reviewCount?: number | null
    thumbnail?: string | null
}

/** 1x1 transparent GIF. Quick Look needs the anchor to wrap exactly one <img>. */
const BLANK_PIXEL =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** Height of the floating top bar, in CSS pixels. */
const TOP_BAR = 64
/** Gap below the bottom sheet, from its container's padding. */
const SHEET_GAP = 14

export function ArWorld({
    items,
    startId,
    backHref,
}: {
    items: ArMenuDish[]
    startId?: string | null
    backHref: string
}) {
    const startIndex = Math.max(0, items.findIndex((d) => d.id === startId))

    const [index, setIndex] = useState(startIndex)
    const [mode, setMode] = useState<ArMode>("studio")
    const [progress, setProgress] = useState<number | null>(0)
    const [hint, setHint] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [ready, setReady] = useState(false)

    // resolved after mount — these read `navigator`/`document`, which do not
    // exist during SSR, so reading them while rendering would desync hydration
    const [launch, setLaunch] = useState<ArLaunch | null>(null)
    const [reachable, setReachable] = useState(true)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const overlayRef = useRef<HTMLDivElement | null>(null)
    const sheetRef = useRef<HTMLDivElement | null>(null)
    const engineRef = useRef<ArEngine | null>(null)

    /** Height the bottom sheet is covering, so the dish can be framed above it. */
    const [sheetPx, setSheetPx] = useState(0)

    const dish = items[Math.min(index, items.length - 1)]

    const step = useCallback(
        (dir: -1 | 1) => setIndex((cur) => (cur + dir + items.length) % items.length),
        [items.length],
    )

    const cardFor = useCallback(
        (d: ArMenuDish) => ({
            title: d.title,
            price: d.priceLabel,
            diet: d.diet,
            rating: d.rating,
            reviewCount: d.reviewCount,
        }),
        [],
    )

    // --- engine lifecycle -------------------------------------------------

    useEffect(() => {
        let dead = false
        const canvas = canvasRef.current
        const overlay = overlayRef.current
        if (!canvas || !overlay) return

        void createArEngine({
            canvas,
            overlay,
            canSwitch: items.length > 1,
            onSwipe: (dir) => step(dir),
            hooks: {
                onHint: setHint,
                onProgress: setProgress,
                onMode: setMode,
                onError: setError,
            },
        })
            .then((engine) => {
                if (dead) {
                    engine.dispose()
                    return
                }
                engineRef.current = engine
                setReady(true)
            })
            .catch((err) => {
                if (dead) return
                setError(err instanceof Error ? err.message : "3D is not available in this browser")
                setProgress(null)
            })

        return () => {
            dead = true
            engineRef.current?.dispose()
            engineRef.current = null
        }
        // the engine is built once; `step` is stable for a fixed item count
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Which AR mechanism this device actually has. Depends on the dish because
    // Quick Look needs a .usdz and Scene Viewer needs a plain .glb.
    useEffect(() => {
        setReachable(isPubliclyReachable(window.location.origin))
        void detectArLaunch({ glbAr: dish?.glbAr, usdz: dish?.usdz }).then(setLaunch)
    }, [dish?.glbAr, dish?.usdz])

    useEffect(() => {
        if (!ready || !dish) return
        setError(null)
        void engineRef.current?.showDish(dish.glb, cardFor(dish), dish.sizeMeters)
    }, [ready, dish, index, cardFor])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") step(-1)
            if (e.key === "ArrowRight") step(1)
            if (e.key === "Escape" && mode !== "studio") engineRef.current?.leaveImmersive()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [step, mode])

    // Taps on the WebXR dom-overlay must not also fire an XR select, or every
    // button press would re-place the dish.
    useEffect(() => {
        const el = overlayRef.current
        if (!el) return
        const stop = (e: Event) => e.preventDefault()
        el.addEventListener("beforexrselect", stop)
        return () => el.removeEventListener("beforexrselect", stop)
    }, [])

    /**
     * Keep the dish centred in the gap between the top bar and the bottom sheet
     * rather than in the whole viewport, so the sheet stops covering it.
     *
     * Measured rather than hardcoded: the sheet grows and shrinks with the
     * thumbnail rail and with how many AR buttons this device qualifies for.
     */
    useEffect(() => {
        const el = sheetRef.current
        if (!el) {
            setSheetPx(0)
            engineRef.current?.setFrame(0, 0)
            return
        }
        const measure = () => {
            const covered = el.getBoundingClientRect().height + SHEET_GAP
            setSheetPx(covered)
            engineRef.current?.setFrame(TOP_BAR, covered)
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [ready, mode, launch, items.length])

    // --- actions ----------------------------------------------------------

    async function startXr() {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            await engineRef.current?.enterXr()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start AR")
        } finally {
            setBusy(false)
        }
    }

    async function savePhoto() {
        const blob = await engineRef.current?.snapshot()
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${slugify(dish?.title || "dish")}-ar.jpg`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
    }

    const immersive = mode !== "studio"
    /**
     * The dom-overlay root has to be visible *before* requestSession adopts it,
     * so this also covers the moment the session is starting up.
     */
    const xrUi = mode === "xr" || busy
    const meta = useMemo(
        () => [dish?.ready, dietLabel(dish?.diet), dish?.serve].filter(Boolean).join(" · "),
        [dish],
    )
    /** True only when tapping the CTA will hand off to a plane-detecting runtime. */
    const realAr = launch !== null && launch !== "none" && (launch === "webxr" || reachable)

    // Built after mount because the Scene Viewer intent embeds the current page
    // as its fallback URL, and `window` does not exist during SSR.
    const [sceneHref, setSceneHref] = useState<string | null>(null)
    useEffect(() => {
        if (launch !== "scene-viewer" || !dish?.glbAr) {
            setSceneHref(null)
            return
        }
        setSceneHref(
            sceneViewerHref({
                glbAr: dish.glbAr,
                title: dish.title,
                fallbackUrl: window.location.href,
            }),
        )
    }, [launch, dish?.glbAr, dish?.title])

    const ctaClass =
        "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-400 text-sm font-semibold text-zinc-950 disabled:opacity-60"

    return (
        <div className="relative min-h-dvh overflow-hidden bg-[#05070c] text-white">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(120% 80% at 50% 12%, #16304a 0%, #0b1524 42%, #05070c 78%), radial-gradient(60% 40% at 50% 96%, rgba(34,211,238,0.16), transparent 70%)",
                }}
            />

            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

            {/* ---------------------------------------------------- top bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                {immersive ? (
                    <button
                        type="button"
                        onClick={() => engineRef.current?.leaveImmersive()}
                        className="flex h-10 items-center gap-1.5 rounded-full bg-black/55 px-4 text-[13px] font-medium backdrop-blur"
                    >
                        <X className="h-4 w-4" />
                        Exit
                    </button>
                ) : (
                    <a
                        href={backHref}
                        aria-label="Back to the menu"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </a>
                )}

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => engineRef.current?.resetView()}
                        aria-label="Reset the view"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void savePhoto()}
                        aria-label="Save a photo"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur"
                    >
                        <Camera className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {progress !== null ? (
                <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
                    // sits in the same gap the dish is framed in, not the raw viewport
                    style={{ top: TOP_BAR, bottom: sheetPx }}
                >
                    <ProgressRing value={progress} />
                </div>
            ) : null}

            {immersive && hint ? (
                <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-6">
                    <p className="rounded-full bg-black/60 px-4 py-2 text-center text-[12.5px] leading-snug backdrop-blur">
                        {hint}
                    </p>
                </div>
            ) : null}

            {items.length > 1 && !immersive ? (
                <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center justify-between px-2"
                    style={{ top: TOP_BAR, bottom: sheetPx }}
                >
                    <SideArrow side="left" onClick={() => step(-1)} />
                    <SideArrow side="right" onClick={() => step(1)} />
                </div>
            ) : null}

            {/* ------------------------------------------------ bottom sheet */}
            {!immersive ? (
                <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                    <div
                        ref={sheetRef}
                        className="mx-auto max-w-md rounded-[1.6rem] border border-white/10 bg-black/55 p-4 backdrop-blur-xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-[17px] font-semibold leading-tight">{dish?.title}</p>
                                <p className="mt-0.5 truncate text-[12px] text-white/60">{meta}</p>
                            </div>
                            <p className="shrink-0 text-[17px] font-bold text-cyan-300">{dish?.priceLabel}</p>
                        </div>

                        {items.length > 1 ? (
                            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {items.map((d, i) => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => setIndex(i)}
                                        aria-label={d.title}
                                        aria-current={i === index}
                                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition ${
                                            i === index
                                                ? "border-cyan-300 ring-2 ring-cyan-300/40"
                                                : "border-white/12 opacity-70"
                                        }`}
                                    >
                                        {d.thumbnail ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={d.thumbnail} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] leading-tight">
                                                {d.title.slice(0, 8)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                            {realAr && launch === "webxr" ? (
                                <button type="button" disabled={busy} onClick={() => void startXr()} className={ctaClass}>
                                    <Sparkles className="h-4 w-4" />
                                    {busy ? "Starting…" : "Place on your table"}
                                </button>
                            ) : null}

                            {realAr && launch === "scene-viewer" && sceneHref ? (
                                // a real link, not a scripted navigation: Android
                                // handles intent:// hrefs directly and honours the
                                // browser_fallback_url when ARCore is absent
                                <a href={sceneHref} className={ctaClass}>
                                    <Sparkles className="h-4 w-4" />
                                    Place on your table
                                </a>
                            ) : null}

                            {realAr && launch === "quick-look" && dish?.usdz ? (
                                <div className="relative h-12 w-full">
                                    <span className={`${ctaClass} pointer-events-none absolute inset-0`} aria-hidden>
                                        <Sparkles className="h-4 w-4" />
                                        Place on your table
                                    </span>
                                    {/* Quick Look only takes over a link whose
                                        single child is an <img>, and only when a
                                        finger lands on the link itself — a hidden
                                        anchor clicked from script never starts a
                                        session. So the anchor *is* the full-size
                                        tap target, with the label behind it. */}
                                    <a
                                        rel="ar"
                                        href={quickLookHref(dish.usdz)}
                                        aria-label="Place on your table"
                                        className="absolute inset-0 block"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={BLANK_PIXEL} alt="" className="h-full w-full" />
                                    </a>
                                </div>
                            ) : null}
                            <ArNote launch={launch} reachable={reachable} />
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ------------------------------ WebXR dom-overlay root
                Always mounted, with real layout and its children present.
                `domOverlay: { root }` is handed over at requestSession time,
                which is *before* `mode` flips to "xr" — a root that is
                display:none or empty at that moment cannot become an overlay,
                which is why gating this on the mode hid it entirely. */}
            <div
                ref={overlayRef}
                className="pointer-events-none fixed inset-0 z-40"
                style={{ opacity: xrUi ? 1 : 0 }}
                aria-hidden={!xrUi}
            >
                <div className="absolute inset-0 flex flex-col justify-between p-4">
                    <div className={`flex justify-between ${xrUi ? "pointer-events-auto" : ""}`}>
                        <button
                            type="button"
                            onClick={() => engineRef.current?.leaveImmersive()}
                            className="flex h-11 items-center gap-1.5 rounded-full bg-black/60 px-4 text-[13px] font-medium text-white backdrop-blur"
                        >
                            <X className="h-4 w-4" /> Exit
                        </button>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => engineRef.current?.resetView()}
                                className="flex h-11 items-center gap-1.5 rounded-full bg-black/60 px-4 text-[13px] font-medium text-white backdrop-blur"
                            >
                                <RotateCcw className="h-4 w-4" /> Move
                            </button>
                            <button
                                type="button"
                                onClick={() => void savePhoto()}
                                aria-label="Save a photo"
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Bottom band: the arrows flank the title rather than
                        sitting at the vertical centre of the screen, which is
                        exactly where a placed dish is and so covered it. */}
                    <div className="flex items-end justify-center gap-3">
                        {items.length > 1 ? (
                            <button
                                type="button"
                                onClick={() => step(-1)}
                                aria-label="Previous dish in AR"
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:scale-95 ${
                                    xrUi ? "pointer-events-auto" : ""
                                }`}
                            >
                                <ChevronLeft className="h-7 w-7" />
                            </button>
                        ) : null}

                        <div className="min-w-0 flex-1 rounded-2xl bg-black/60 px-4 py-2.5 text-center text-white backdrop-blur">
                            <p className="truncate text-[13px] font-semibold leading-tight">{dish?.title}</p>
                            <p className="text-[11px] text-cyan-300">{dish?.priceLabel}</p>
                        </div>

                        {items.length > 1 ? (
                            <button
                                type="button"
                                onClick={() => step(1)}
                                aria-label="Next dish in AR"
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:scale-95 ${
                                    xrUi ? "pointer-events-auto" : ""
                                }`}
                            >
                                <ChevronRight className="h-7 w-7" />
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {error ? (
                <div
                    className="absolute inset-x-0 z-30 px-5"
                    style={{ bottom: (immersive ? 96 : sheetPx) + 12 }}
                >
                    <p className="mx-auto max-w-md rounded-2xl bg-rose-500/15 px-4 py-2.5 text-center text-[12.5px] leading-snug text-rose-100 ring-1 ring-rose-400/30">
                        {error}
                    </p>
                </div>
            ) : null}
        </div>
    )
}

/**
 * No status text in the normal case — the button either appears or it does not.
 *
 * The one exception is a phone that has the assets but cannot reach them,
 * which would otherwise be a silent dead end.
 */
function ArNote({ launch, reachable }: { launch: ArLaunch | null; reachable: boolean }) {
    if (reachable || launch === null || launch === "none" || launch === "webxr") return null
    return (
        <p className="pt-1 text-center text-[11.5px] leading-relaxed text-amber-200/70">
            Table AR needs a public https link — open the shared tunnel URL, not localhost.
        </p>
    )
}

function SideArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={side === "left" ? "Previous dish" : "Next dish"}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur transition active:scale-95"
        >
            <Icon className="h-5 w-5" />
        </button>
    )
}

function ProgressRing({ value }: { value: number }) {
    const pct = Math.round(value * 100)
    const r = 26
    const c = 2 * Math.PI * r
    return (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/45 px-6 py-5 backdrop-blur">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - Math.max(0.02, value))}
                />
            </svg>
            <p className="text-[12px] tabular-nums text-white/70">{pct}%</p>
        </div>
    )
}

function slugify(s: string) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}
