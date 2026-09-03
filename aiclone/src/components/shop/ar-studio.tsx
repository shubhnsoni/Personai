"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImageIcon, Upload, X, Sparkles, Box, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ensureModelViewer } from "@/lib/model-viewer"
import { glbToFile, photoToGlb, photoToSculptedGlb, type ArShape } from "@/lib/photo-glb"
import { ORBIT_TARGET, yawBin, type OrbitFrame } from "@/lib/orbit-glb"
import { cropVideo, polarRing, polarShift, signedDeg, unwrapDeg, wrapDeg } from "@/lib/orbit-track"
import { cn } from "@/lib/utils"

const SHAPES: { id: ArShape; label: string; blurb: string }[] = [
    { id: "plate", label: "Plate", blurb: "Food on a dish" },
    { id: "stand", label: "Stand", blurb: "A product on a base" },
    { id: "card", label: "Card", blurb: "A standing photo" },
]

type Mode = "pick" | "camera" | "orbit" | "preview"

export function ArStudio({
    open,
    onOpenChange,
    onReady,
    existing,
    sourcePhotos,
    restaurant,
    onPhotoreal,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onReady: (glbUrl: string, usdzUrl?: string) => void
    existing?: string | null
    sourcePhotos?: string[]
    restaurant?: boolean
    onPhotoreal?: () => void
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [mode, setMode] = useState<Mode>("pick")
    const [photo, setPhoto] = useState<string | null>(null)
    const [shape, setShape] = useState<ArShape>(restaurant ? "plate" : "stand")
    const [busy, setBusy] = useState(false)
    const [preview, setPreview] = useState<string | null>(existing || null)
    const [status, setStatus] = useState("")
    const [frames, setFrames] = useState<OrbitFrame[]>([])
    const [livePitch, setLivePitch] = useState<number | null>(null)
    const [viewYaw, setViewYaw] = useState(0)
    const [spinHint, setSpinHint] = useState<"hold" | "spin" | "walk">("hold")
    const liveYawRef = useRef<number | null>(null)
    const viewYawRef = useRef(0)
    const polarFirstRef = useRef<Float32Array | null>(null)
    const opticalYawRef = useRef(0)
    const opticalOkRef = useRef(false)
    const phoneOriginRef = useRef<number | null>(null)
    const lastSnapRef = useRef(0)
    const framesRef = useRef<OrbitFrame[]>([])
    const busyRef = useRef(false)
    const startedAtRef = useRef(0)
    const trackCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const tickSkipRef = useRef(0)
    const lastHintRef = useRef<"hold" | "spin" | "walk">("hold")
    const lastBinUiRef = useRef(-1)
    const lastSnapYawRef = useRef<number | null>(null)
    framesRef.current = frames
    busyRef.current = busy

    useEffect(() => {
        if (open) {
            ensureModelViewer()
            setMode(existing ? "preview" : "pick")
            setPreview(existing || null)
            setPhoto(null)
            setShape(restaurant ? "plate" : "stand")
            setFrames([])
            setViewYaw(0)
            setSpinHint("hold")
            polarFirstRef.current = null
            opticalYawRef.current = 0
            opticalOkRef.current = false
            phoneOriginRef.current = null
        } else {
            stopCam()
        }
    }, [open, existing, restaurant])

    useEffect(() => {
        if (mode !== "camera" && mode !== "orbit") {
            stopCam()
            return
        }
        let gone = false
        navigator.mediaDevices
            ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1440 } }, audio: false })
            .then((stream) => {
                if (gone) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                }
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    void videoRef.current.play()
                }
            })
            .catch(() => {
                toast.error("Camera blocked. Use the gallery instead.")
                setMode("pick")
            })
        return () => {
            gone = true
        }
    }, [mode])

    useEffect(() => {
        if (mode !== "orbit") return
        const onOrient = (e: DeviceOrientationEvent) => {
            const heading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
            const a = typeof heading === "number" ? heading : e.alpha
            if (typeof a === "number") liveYawRef.current = a
            if (typeof e.beta === "number") setLivePitch(e.beta)
        }
        window.addEventListener("deviceorientation", onOrient, true)
        return () => window.removeEventListener("deviceorientation", onOrient, true)
    }, [mode])

    const orbitFilled = frames.filter((f) => f.kind !== "top").length
    const hasTop = frames.some((f) => f.kind === "top")
    const currentBin = yawBin(viewYaw, 0)
    const binTaken = (bin: number) => frames.some((f) => f.kind !== "top" && yawBin(f.yaw, 0) === bin)

    useEffect(() => {
        if (mode !== "orbit") return
        let raf = 0
        let alive = true
        const tick = () => {
            if (!alive) return
            const video = videoRef.current
            tickSkipRef.current++
            if (tickSkipRef.current % 2 === 0 && video?.videoWidth) {
                if (!trackCanvasRef.current) trackCanvasRef.current = document.createElement("canvas")
                const img = cropVideo(video, 128, trackCanvasRef.current)
                if (img) {
                    const { ring, energy } = polarRing(img)
                    if (polarFirstRef.current) {
                        const hit = polarShift(polarFirstRef.current, ring)
                        if (hit.score > 0.22 && energy > 6) {
                            const next = unwrapDeg(hit.deg, opticalYawRef.current)
                            if (Math.abs(next - opticalYawRef.current) < 40) {
                                opticalYawRef.current = next
                                opticalOkRef.current = true
                            }
                        }
                    }
                    const phone = liveYawRef.current
                    if (phoneOriginRef.current == null && phone != null) phoneOriginRef.current = phone
                    const phoneD = phone != null && phoneOriginRef.current != null ? wrapDeg(phone - phoneOriginRef.current) : 0
                    const optical = wrapDeg(opticalYawRef.current)
                    const view = opticalOkRef.current ? optical : phoneD
                    viewYawRef.current = view
                    const spinMore = opticalOkRef.current && Math.abs(signedDeg(optical)) > Math.abs(signedDeg(phoneD)) + 10
                    const hint = spinMore ? "spin" : Math.abs(signedDeg(phoneD)) > 10 ? "walk" : "hold"
                    if (hint !== lastHintRef.current) {
                        lastHintRef.current = hint
                        setSpinHint(hint)
                    }
                    const uiBin = yawBin(view, 0)
                    if (uiBin !== lastBinUiRef.current) {
                        lastBinUiRef.current = uiBin
                        setViewYaw(view)
                    }
                    const filled = framesRef.current.filter((f) => f.kind !== "top").length
                    const now = Date.now()
                    const lastYaw = lastSnapYawRef.current
                    const turned = lastYaw == null
                        ? Math.abs(signedDeg(view)) >= 18
                        : Math.abs(signedDeg(view - lastYaw)) >= 18
                    const moving = opticalOkRef.current || Math.abs(signedDeg(phoneD)) > 12
                    if (!busyRef.current && filled < ORBIT_TARGET && now - lastSnapRef.current > 700 && turned && moving) {
                        grabOrbit()
                    }
                }
            }
            raf = window.requestAnimationFrame(tick)
        }
        raf = window.requestAnimationFrame(tick)
        return () => {
            alive = false
            window.cancelAnimationFrame(raf)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])

    function stopCam() {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }

    function snapStill() {
        const shot = grabJpeg()
        if (!shot) return
        setPhoto(shot)
        stopCam()
        setMode("preview")
    }

    function grabJpeg() {
        const video = videoRef.current
        if (!video || !video.videoWidth) return null
        const canvas = document.createElement("canvas")
        const side = Math.min(video.videoWidth, video.videoHeight)
        canvas.width = 768
        canvas.height = 768
        const sx = (video.videoWidth - side) / 2
        const sy = (video.videoHeight - side) / 2
        canvas.getContext("2d")?.drawImage(video, sx, sy, side, side, 0, 0, 768, 768)
        return canvas.toDataURL("image/jpeg", 0.9)
    }

    function grabOrbit() {
        const shot = grabJpeg()
        if (!shot) return
        let yaw = viewYawRef.current
        const pitch = livePitch ?? 40
        const top = pitch > 58 && !framesRef.current.some((f) => f.kind === "top")
        if (!top) {
            const taken = (bin: number) => framesRef.current.some((f) => f.kind !== "top" && yawBin(f.yaw, 0) === bin)
            if (taken(yawBin(yaw, 0))) {
                let found = false
                for (let i = 0; i < ORBIT_TARGET; i++) {
                    if (!taken(i)) {
                        yaw = i * (360 / ORBIT_TARGET)
                        found = true
                        break
                    }
                }
                if (!found) return
            }
        }
        const next: OrbitFrame = { dataUrl: shot, yaw, pitch, kind: top ? "top" : "orbit" }
        setFrames((cur) => {
            if (next.kind === "top") {
                if (cur.some((f) => f.kind === "top")) return cur
            } else {
                const bin = yawBin(next.yaw, 0)
                if (cur.some((f) => f.kind !== "top" && yawBin(f.yaw, 0) === bin)) return cur
            }
            lastSnapRef.current = Date.now()
            lastSnapYawRef.current = next.yaw
            if (!polarFirstRef.current) {
                const video = videoRef.current
                if (video) {
                    const img = cropVideo(video, 128)
                    if (img) polarFirstRef.current = polarRing(img).ring
                }
            }
            try {
                navigator.vibrate?.(12)
            } catch { /* ignore */ }
            return [...cur, next]
        })
    }

    async function startOrbit() {
        const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
        if (typeof DOE.requestPermission === "function") {
            try {
                await DOE.requestPermission()
            } catch {
                /* optical tracking still works if they spin the dish */
            }
        }
        setFrames([])
        setViewYaw(0)
        setSpinHint("hold")
        polarFirstRef.current = null
        opticalYawRef.current = 0
        opticalOkRef.current = false
        phoneOriginRef.current = null
        lastSnapRef.current = 0
        lastSnapYawRef.current = null
        startedAtRef.current = Date.now()
        liveYawRef.current = null
        viewYawRef.current = 0
        setMode("orbit")
    }

    async function fromFile(file: File) {
        if (/\.(glb|gltf|usdz)$/i.test(file.name)) {
            setBusy(true)
            try {
                const url = await uploadFile(file)
                if (!url) return
                if (/\.usdz$/i.test(file.name)) onReady(preview || url, url)
                else {
                    setPreview(url)
                    onReady(url)
                }
                toast.success("3D file attached")
                onOpenChange(false)
            } finally {
                setBusy(false)
            }
            return
        }
        const url = URL.createObjectURL(file)
        setPhoto(url)
        setMode("preview")
    }

    async function sculptPlate() {
        const src = photo || sourcePhotos?.[0]
        if (!src) {
            toast.error("Take or pick a photo first")
            return
        }
        setBusy(true)
        setStatus("Reading the photo")
        try {
            await wait(160)
            setStatus(shape === "plate" ? "Shaping the plate" : shape === "stand" ? "Building a stand" : "Cutting the card")
            const buf = await photoToGlb(src, shape)
            setStatus("Saving")
            const file = glbToFile(buf, `${shape}-${Date.now()}.glb`)
            const url = await uploadFile(file)
            if (!url) throw new Error("Upload failed")
            setPreview(url)
            onReady(url)
            toast.success("3D is ready — guests can place it on a table")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not make 3D")
        } finally {
            setBusy(false)
            setStatus("")
        }
    }

    async function sculptOrbit() {
        const best = frames.find((f) => f.kind === "top") || frames[Math.floor(frames.length / 2)] || frames[0]
        if (!best) {
            toast.error("Capture at least one angle first")
            return
        }
        setBusy(true)
        try {
            let url: string | null = null
            setStatus("Asking a 3D model of the dish…")
            try {
                const res = await fetch("/api/image-to-3d", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: best.dataUrl }),
                })
                const json = await res.json() as { url?: string; error?: string }
                if (res.ok && json.url) url = json.url
            } catch {
                /* fall through to local sculpt */
            }
            if (!url) {
                setStatus("Painting the dish from your photo")
                const buf = await photoToSculptedGlb(best.dataUrl)
                const file = glbToFile(buf, `dish-${Date.now()}.glb`)
                url = await uploadFile(file)
            }
            if (!url) throw new Error("Upload failed")
            setPreview(url)
            setPhoto(null)
            stopCam()
            setMode("preview")
            onReady(url)
            toast.success("Dish is 3D — guests can place it on a table")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not build 3D")
        } finally {
            setBusy(false)
            setStatus("")
        }
    }

    const lookingDown = (livePitch ?? 0) > 58

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-white/10 bg-zinc-950 p-0 text-zinc-100"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
                <div className="flex items-start justify-between px-5 pt-3">
                    <SheetHeader className="space-y-1 p-0 text-left">
                        <SheetTitle className="text-lg text-white">{restaurant ? "AR dish" : "AR object"}</SheetTitle>
                        <SheetDescription>
                            {restaurant
                                ? "Walk around it, or put it on a stand and spin. We watch the dish rotate."
                                : "Walk around it, spin it on a stand, or drop a GLB."}
                        </SheetDescription>
                    </SheetHeader>
                    <button type="button" className="rounded-full p-1 text-zinc-400" onClick={() => onOpenChange(false)}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
                    {mode === "orbit" ? (
                        <div className="space-y-3">
                            <div className="relative overflow-hidden rounded-[1.6rem] bg-black">
                                <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                                <div className="pointer-events-none absolute inset-0">
                                    <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400/85 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
                                    {Array.from({ length: ORBIT_TARGET }).map((_, i) => {
                                        const a = (i / ORBIT_TARGET) * Math.PI * 2 - Math.PI / 2
                                        const filled = binTaken(i)
                                        const here = i === currentBin
                                        return (
                                            <span
                                                key={i}
                                                className={cn(
                                                    "absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                                                    filled ? "bg-cyan-400" : here ? "bg-white" : "bg-white/35",
                                                )}
                                                style={{
                                                    left: `${50 + Math.cos(a) * 36}%`,
                                                    top: `${50 + Math.sin(a) * 27}%`,
                                                }}
                                            />
                                        )
                                    })}
                                </div>
                                <p className="absolute inset-x-0 top-3 px-4 text-center text-xs text-white/90">
                                    {lookingDown
                                        ? "Nice — this captures the top. Hold still."
                                        : spinHint === "spin"
                                            ? "Keep spinning the dish. Stay in the ring."
                                            : spinHint === "walk"
                                                ? "Keep walking around it. Stay in the ring."
                                                : "Tap the shutter once, then spin the dish or walk around."}
                                </p>
                                <p className="absolute inset-x-0 top-8 text-center text-[11px] text-cyan-300">
                                    {orbitFilled}/{ORBIT_TARGET} around{hasTop ? " · top" : " · dip once over the top"}
                                </p>
                                <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-5">
                                    <button type="button" className="text-sm text-white/70" onClick={() => setMode("pick")}>
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={grabOrbit}
                                        className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-cyan-400"
                                        aria-label="Capture angle"
                                    />
                                    <button
                                        type="button"
                                        disabled={frames.length < 1 || busy}
                                        onClick={() => void sculptOrbit()}
                                        className={cn("text-sm font-medium", frames.length >= 1 ? "text-cyan-300" : "text-white/35")}
                                    >
                                        Build
                                    </button>
                                </div>
                            </div>
                            {frames.length > 0 ? (
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {frames.map((f, i) => (
                                        <img key={i} src={f.dataUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                                    ))}
                                </div>
                            ) : null}
                            {busy ? <p className="text-center text-sm text-cyan-300">{status || "Building 3D…"}</p> : null}
                        </div>
                    ) : mode === "camera" ? (
                        <div className="relative overflow-hidden rounded-[1.6rem] bg-black">
                            <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="h-[62%] w-[62%] rounded-full border-2 border-cyan-400/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
                            </div>
                            <p className="absolute inset-x-0 top-3 text-center text-xs text-white/80">
                                Center the {restaurant ? "dish" : "object"} in the ring
                            </p>
                            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-6">
                                <button type="button" className="text-sm text-white/70" onClick={() => setMode("pick")}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={snapStill}
                                    className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-cyan-400"
                                    aria-label="Capture"
                                />
                                <span className="w-12" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {restaurant ? (
                                <button
                                    type="button"
                                    onClick={() => void startOrbit()}
                                    className="flex w-full items-center gap-3 rounded-[1.35rem] border border-cyan-400/40 bg-cyan-400/10 px-4 py-3.5 text-left"
                                >
                                    <RotateCw className="h-5 w-5 shrink-0 text-cyan-300" />
                                    <span>
                                        <span className="block text-sm font-medium">Scan in 3D</span>
                                        <span className="block text-[12px] text-white/50">Walk around, or put it on a stand and rotate — we detect the spin.</span>
                                    </span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void startOrbit()}
                                    className="flex w-full items-center gap-3 rounded-[1.35rem] border border-cyan-400/40 bg-cyan-400/10 px-4 py-3.5 text-left"
                                >
                                    <RotateCw className="h-5 w-5 shrink-0 text-cyan-300" />
                                    <span>
                                        <span className="block text-sm font-medium">Scan in 3D</span>
                                        <span className="block text-[12px] text-white/50">Walk around it, or rotate it on a stand.</span>
                                    </span>
                                </button>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode("camera")}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center"
                                >
                                    <Camera className="mx-auto h-5 w-5 text-cyan-400" />
                                    <p className="mt-1.5 text-[12px] font-medium">One photo</p>
                                </button>
                                <label className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center">
                                    <ImageIcon className="mx-auto h-5 w-5 text-cyan-400" />
                                    <p className="mt-1.5 text-[12px] font-medium">Gallery</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            e.target.value = ""
                                            if (file) void fromFile(file)
                                        }}
                                    />
                                </label>
                                <label className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center">
                                    <Upload className="mx-auto h-5 w-5 text-cyan-400" />
                                    <p className="mt-1.5 text-[12px] font-medium">GLB</p>
                                    <input
                                        type="file"
                                        accept=".glb,.gltf,.usdz,model/gltf-binary"
                                        className="sr-only"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            e.target.value = ""
                                            if (file) void fromFile(file)
                                        }}
                                    />
                                </label>
                            </div>

                            {onPhotoreal ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onOpenChange(false)
                                        onPhotoreal()
                                    }}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-3 text-left"
                                >
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-zinc-950">
                                        <Sparkles className="h-4 w-4" />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-white">Photoreal 3D</span>
                                        <span className="block text-[12px] text-zinc-400">Paid. Built from a photo. Guests put it on the table.</span>
                                    </span>
                                </button>
                            ) : null}

                            {sourcePhotos?.[0] && !photo ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPhoto(sourcePhotos[0])
                                        setMode("preview")
                                    }}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-left"
                                >
                                    <img src={sourcePhotos[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />
                                    <span className="text-sm">Use the photo already on this item</span>
                                </button>
                            ) : null}

                            {(photo || preview) && (
                                <>
                                    <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-zinc-900">
                                        {preview ? (
                                            // @ts-expect-error model-viewer
                                            <model-viewer
                                                src={preview}
                                                alt="AR preview"
                                                camera-controls
                                                auto-rotate
                                                shadow-intensity="0.8"
                                                style={{ width: "100%", height: "260px", background: "#09090b" }}
                                            />
                                        ) : photo ? (
                                            <img src={photo} alt="" className="aspect-square w-full object-cover" />
                                        ) : null}
                                    </div>
                                    {photo ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {SHAPES.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setShape(s.id)}
                                                    className={cn(
                                                        "rounded-2xl border px-2 py-2.5 text-left",
                                                        shape === s.id ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5",
                                                    )}
                                                >
                                                    <p className="text-sm font-medium">{s.label}</p>
                                                    <p className="text-[11px] text-zinc-400">{s.blurb}</p>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {mode === "preview" || (mode === "pick" && (photo || sourcePhotos?.[0] || preview)) ? (
                    <div className="shrink-0 border-t border-white/10 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                        <Button
                            className="h-11 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            disabled={busy || (!photo && !sourcePhotos?.[0] && !preview)}
                            onClick={() => void sculptPlate()}
                        >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            {busy ? status || "Sculpting…" : preview && !photo ? "Rebuild from one photo" : "Make a quick plate"}
                        </Button>
                    </div>
                ) : null}
            </SheetContent>
        </Sheet>
    )
}

export function ArTrigger({
    hasModel,
    onClick,
    restaurant,
}: {
    hasModel?: boolean
    onClick: () => void
    restaurant?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2.5 text-left"
        >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                <Box className="h-4 w-4" />
            </span>
            <span className="min-h-0 min-w-0 flex-1">
                <span className="block text-sm font-medium">{hasModel ? "AR ready" : restaurant ? "Add AR dish" : "Add AR"}</span>
                <span className="block text-[12px] text-muted-foreground">
                    {hasModel
                        ? "Tap to change or rescan"
                        : restaurant
                            ? "Walk around or spin it on a stand"
                            : "Walk around, spin it, or drop a GLB"}
                </span>
            </span>
        </button>
    )
}

async function uploadFile(file: File) {
    const body = new FormData()
    body.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body })
    const json = await res.json()
    if (!json.url) {
        toast.error(json.error || "Upload failed")
        return null
    }
    return json.url as string
}

function wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}
