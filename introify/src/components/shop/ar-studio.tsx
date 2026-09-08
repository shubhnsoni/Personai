"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImageIcon, Upload, Sparkles, Box } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ensureModelViewer } from "@/lib/model-viewer"
import { arChargeCents } from "@/lib/ar-price"
import { useMoney } from "@/components/pricing-provider"

type Mode = "pick" | "camera" | "preview"

export function ArStudio({
    open,
    onOpenChange,
    onReady,
    existing,
    sourcePhotos,
    restaurant,
    onPhotoreal,
    onPhoto,
    profileId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onReady: (glbUrl: string, usdzUrl?: string) => void
    existing?: string | null
    sourcePhotos?: string[]
    restaurant?: boolean
    onPhotoreal?: () => void
    onPhoto?: (url: string) => void
    profileId?: string
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [mode, setMode] = useState<Mode>("pick")
    const [photo, setPhoto] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [preview, setPreview] = useState<string | null>(existing || null)
    const [status, setStatus] = useState("")
    const [ask3d, setAsk3d] = useState(false)
    const money = useMoney()
    const priceLabel = money(arChargeCents(1), "USD")

    useEffect(() => {
        if (open) {
            ensureModelViewer()
            setMode(existing ? "preview" : "pick")
            setPreview(existing || null)
            setPhoto(null)
            setAsk3d(false)
        } else {
            stopCam()
        }
    }, [open, existing])

    useEffect(() => {
        if (mode !== "camera") {
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

    function stopCam() {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }

    function holdPhoto(src: string) {
        setPhoto(src)
        onPhoto?.(src)
        stopCam()
        setMode("preview")
        setAsk3d(true)
    }

    function snapStill() {
        const shot = grabJpeg()
        if (!shot) return
        holdPhoto(shot)
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
        holdPhoto(url)
    }

    async function buildFromPhoto(src?: string | null) {
        const photoSrc = src || photo || sourcePhotos?.[0]
        if (!photoSrc) {
            toast.error("Add a photo first — take one or pick one from the gallery")
            setMode("pick")
            return
        }
        setBusy(true)
        setAsk3d(false)
        setStatus("Reading the photo")
        try {
            const dataUrl = await asDataUrl(photoSrc)
            setStatus("Building a 3D model…")
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            if (profileId) headers["x-profile-id"] = profileId
            const res = await fetch("/api/image-to-3d", {
                method: "POST",
                headers,
                body: JSON.stringify({ image: dataUrl }),
            })
            const json = await res.json() as { url?: string; error?: string }
            if (res.status === 429) {
                toast.error("This hour’s 3D quota is used. Try photoreal 3D, or wait and retry.")
                return
            }
            if (!res.ok || !json.url) throw new Error(json.error || "3D studio couldn’t build this photo")
            setPreview(json.url)
            setPhoto(null)
            stopCam()
            setMode("preview")
            onReady(json.url)
            toast.success("3D is ready — it can be placed on a table")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not make 3D")
        } finally {
            setBusy(false)
            setStatus("")
        }
    }

    const subject = restaurant ? "dish" : "object"

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-white/10 bg-zinc-950 p-0 text-zinc-100"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
                <div className="px-5 pr-12 pt-3">
                    <SheetHeader className="space-y-1 p-0 pr-12 text-left">
                        <SheetTitle className="text-lg text-white">{restaurant ? "AR dish" : "AR object"}</SheetTitle>
                        <SheetDescription>
                            Take a photo or pick one from the gallery. We build 3D with the studio for {priceLabel}.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
                    {mode === "camera" ? (
                        <div className="relative overflow-hidden rounded-[1.6rem] bg-black">
                            <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="h-[62%] w-[62%] rounded-full border-2 border-cyan-400/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
                            </div>
                            <p className="absolute inset-x-0 top-3 text-center text-xs text-white/80">
                                Center the {subject} in the ring
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
                            <button
                                type="button"
                                onClick={() => setMode("camera")}
                                className="flex w-full items-center gap-3 rounded-[1.35rem] border border-cyan-400/40 bg-cyan-400/10 px-4 py-3.5 text-left"
                            >
                                <Camera className="h-5 w-5 shrink-0 text-cyan-300" />
                                <span>
                                    <span className="block text-sm font-medium">Take photo</span>
                                    <span className="block text-[12px] text-white/50">
                                        Then we’ll ask to turn it into 3D for {priceLabel}.
                                    </span>
                                </span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center">
                                    <ImageIcon className="mx-auto h-5 w-5 text-cyan-400" />
                                    <p className="mt-1.5 text-[12px] font-medium">Select from gallery</p>
                                    <p className="text-[11px] text-white/40">Photos on this phone</p>
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
                                    <p className="mt-1.5 text-[12px] font-medium">Upload GLB</p>
                                    <p className="text-[11px] text-white/40">Already have a model</p>
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

                            {sourcePhotos?.[0] && !photo ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        holdPhoto(sourcePhotos[0])
                                    }}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-left"
                                >
                                    <img src={sourcePhotos[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />
                                    <span>
                                        <span className="block text-sm font-medium">Use the photo already on this item</span>
                                        <span className="block text-[12px] text-white/50">We’ll ask to build 3D for {priceLabel}.</span>
                                    </span>
                                </button>
                            ) : null}

                            {(photo || preview) && (
                                <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-zinc-900">
                                    {preview && !photo ? (
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
                            )}

                            {ask3d && photo ? (
                                <div className="space-y-2 rounded-[1.35rem] border border-cyan-400/35 bg-cyan-400/10 p-4">
                                    <p className="text-sm font-medium">Turn this photo into 3D?</p>
                                    <p className="text-[12px] text-white/60">
                                        Uses the in-house 3D studio. Current price {priceLabel}.
                                    </p>
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 flex-1 rounded-full border-white/20 bg-transparent text-white"
                                            disabled={busy}
                                            onClick={() => setAsk3d(false)}
                                        >
                                            Keep photo only
                                        </Button>
                                        <Button
                                            type="button"
                                            className="h-10 flex-[1.3] rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                                            disabled={busy}
                                            onClick={() => void buildFromPhoto(photo)}
                                        >
                                            <Sparkles className="mr-1.5 h-4 w-4" />
                                            {busy ? status || "Building…" : `Make 3D · ${priceLabel}`}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            {onPhotoreal ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onOpenChange(false)
                                        onPhotoreal()
                                    }}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left"
                                >
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-zinc-950">
                                        <Sparkles className="h-4 w-4" />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-white">Photoreal 3D — upgrade</span>
                                        <span className="block text-[12px] text-zinc-400">Paid. Sharper model from the same photo.</span>
                                    </span>
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>

                {mode === "preview" && !ask3d && (photo || sourcePhotos?.[0]) ? (
                    <div className="shrink-0 border-t border-white/10 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                        <Button
                            className="h-11 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            disabled={busy || (!photo && !sourcePhotos?.[0])}
                            onClick={() => void buildFromPhoto()}
                        >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            {busy ? status || "Building 3D…" : `Make 3D · ${priceLabel}`}
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
                        ? "Tap to change or rebuild"
                        : "Take a photo or pick from gallery — we build 3D"}
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

async function asDataUrl(src: string) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = "anonymous"
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("Could not read the photo"))
        image.src = src
    })
    const canvas = document.createElement("canvas")
    const max = 1280
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
}
