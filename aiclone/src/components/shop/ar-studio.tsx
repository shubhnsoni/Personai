"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImageIcon, Upload, X, Sparkles, Box } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ensureModelViewer } from "@/lib/model-viewer"
import { glbToFile, photoToGlb, type ArShape } from "@/lib/photo-glb"
import { cn } from "@/lib/utils"

const SHAPES: { id: ArShape; label: string; blurb: string }[] = [
    { id: "plate", label: "Plate", blurb: "Food on a dish" },
    { id: "stand", label: "Stand", blurb: "A product on a base" },
    { id: "card", label: "Card", blurb: "A standing photo" },
]

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
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onReady: (glbUrl: string, usdzUrl?: string) => void
    existing?: string | null
    sourcePhotos?: string[]
    restaurant?: boolean
    onPhotoreal?: () => void
    onPhoto?: (url: string) => void
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [mode, setMode] = useState<Mode>("pick")
    const [photo, setPhoto] = useState<string | null>(null)
    const [shape, setShape] = useState<ArShape>(restaurant ? "plate" : "stand")
    const [busy, setBusy] = useState(false)
    const [preview, setPreview] = useState<string | null>(existing || null)
    const [status, setStatus] = useState("")

    useEffect(() => {
        if (open) {
            ensureModelViewer()
            setMode(existing ? "preview" : "pick")
            setPreview(existing || null)
            setPhoto(null)
            setShape(restaurant ? "plate" : "stand")
        } else {
            stopCam()
        }
    }, [open, existing, restaurant])

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

    function snapStill() {
        const shot = grabJpeg()
        if (!shot) return
        setPhoto(shot)
        onPhoto?.(shot)
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
        onPhoto?.(url)
        setMode("preview")
    }

    /** The photo IS the input. Ask the 3D service first, sculpt locally if it cannot answer. */
    async function buildFromPhoto(src?: string | null) {
        const photoSrc = src || photo || sourcePhotos?.[0]
        if (!photoSrc) {
            toast.error("Add a photo first — take one or attach one from your gallery")
            setMode("pick")
            return
        }
        setBusy(true)
        setStatus("Reading the photo")
        try {
            const dataUrl = await asDataUrl(photoSrc)
            let url: string | null = null
            setStatus("Building a 3D model from your photo\u2026")
            try {
                const res = await fetch("/api/image-to-3d", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: dataUrl }),
                })
                const json = await res.json() as { url?: string; error?: string }
                if (res.ok && json.url) url = json.url
            } catch {
                /* fall through to the local sculpt */
            }
            if (!url) {
                setStatus(shape === "plate" ? "Shaping the plate" : shape === "stand" ? "Building a stand" : "Cutting the card")
                const buf = await photoToGlb(dataUrl, shape)
                setStatus("Saving")
                const file = glbToFile(buf, `${shape}-${Date.now()}.glb`)
                url = await uploadFile(file)
            }
            if (!url) throw new Error("Upload failed")
            setPreview(url)
            setPhoto(null)
            stopCam()
            setMode("preview")
            onReady(url)
            toast.success("3D is ready — it can be placed on a table")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not make 3D")
        } finally {
            setBusy(false)
            setStatus("")
        }
    }

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
                                ? "Take one photo of the dish and we build the 3D. Or drop a GLB."
                                : "Take one photo and we build the 3D. Or drop a GLB."}
                        </SheetDescription>
                    </SheetHeader>
                    <button type="button" className="rounded-full p-1 text-zinc-400" onClick={() => onOpenChange(false)}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
                    {mode === "camera" ? (
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
                            <button
                                type="button"
                                onClick={() => setMode("camera")}
                                className="flex w-full items-center gap-3 rounded-[1.35rem] border border-cyan-400/40 bg-cyan-400/10 px-4 py-3.5 text-left"
                            >
                                <Camera className="h-5 w-5 shrink-0 text-cyan-300" />
                                <span>
                                    <span className="block text-sm font-medium">Take photo</span>
                                    <span className="block text-[12px] text-white/50">
                                        {restaurant
                                            ? "One photo of the dish. We turn it into a 3D model guests can put on their table."
                                            : "One photo of the object. We turn it into a 3D model buyers can place in their space."}
                                    </span>
                                </span>
                            </button>

                            {sourcePhotos?.[0] && !photo ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void buildFromPhoto(sourcePhotos[0])}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-left"
                                >
                                    <img src={sourcePhotos[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />
                                    <span>
                                        <span className="block text-sm font-medium">Use the photo already on this item</span>
                                        <span className="block text-[12px] text-white/50">Skip the camera — build the 3D from this photo.</span>
                                    </span>
                                </button>
                            ) : null}

                            <div className="grid grid-cols-2 gap-2">
                                <label className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center">
                                    <ImageIcon className="mx-auto h-5 w-5 text-cyan-400" />
                                    <p className="mt-1.5 text-[12px] font-medium">Attach photo</p>
                                    <p className="text-[11px] text-white/40">From your gallery</p>
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
                                        <span className="block text-[12px] text-zinc-400">Paid. Sharper model built from the same photo.</span>
                                    </span>
                                </button>
                            ) : null}

                            {!photo && !preview && !sourcePhotos?.[0] ? (
                                <p className="text-center text-[12px] text-white/45">
                                    Add a photo first — take one or attach one from your gallery, and we build the 3D from it.
                                </p>
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
                            disabled={busy || (!photo && !sourcePhotos?.[0])}
                            onClick={() => void buildFromPhoto()}
                        >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            {busy ? status || "Building 3D…" : preview && !photo ? "Rebuild from this photo" : "Make it 3D"}
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
                        : restaurant
                            ? "One photo of the dish becomes 3D"
                            : "One photo becomes 3D, or drop a GLB"}
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

/** The 3D service needs bytes, and a gallery pick is only a blob: URL. */
async function asDataUrl(src: string) {
    if (src.startsWith("data:")) return src
    const blob = await (await fetch(src)).blob()
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("Could not read the photo"))
        reader.readAsDataURL(blob)
    })
}
