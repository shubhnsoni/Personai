"use client"

import { Camera, Images, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function SquarePhotoSlots({
    urls,
    max = 3,
    uploading,
    onChange,
    onUpload,
    label = "More details cards",
    hint = "Square photos stacked under More details. Take a photo or pick from the gallery.",
}: {
    urls: string[]
    max?: number
    uploading?: boolean
    onChange: (urls: string[]) => void
    onUpload: (file: File) => Promise<string | null>
    label?: string
    hint?: string
}) {
    const slots = Array.from({ length: max }, (_, i) => urls[i] || null)

    async function replace(index: number, file: File) {
        const url = await onUpload(file)
        if (!url) return
        const next = [...urls]
        if (index >= next.length) next.push(url)
        else next[index] = url
        onChange(next.filter(Boolean))
    }

    function remove(index: number) {
        onChange(urls.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-2">
            <div>
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {slots.map((url, i) => (
                    <div key={`${url || "empty"}-${i}`} className="relative">
                        {url ? (
                            <label
                                className={cn(
                                    "relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-solid border-border bg-muted/40",
                                    uploading && "pointer-events-none opacity-60",
                                )}
                            >
                                <img src={url} alt="" className="h-full w-full object-cover" />
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="sr-only"
                                    disabled={uploading}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        e.target.value = ""
                                        if (file) void replace(i, file)
                                    }}
                                />
                            </label>
                        ) : (
                            <div
                                className={cn(
                                    "grid aspect-square w-full grid-cols-2 overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground",
                                    uploading && "pointer-events-none opacity-60",
                                )}
                            >
                                <PickHalf
                                    icon="camera"
                                    label="Photo"
                                    capture="environment"
                                    disabled={uploading}
                                    onFile={(file) => void replace(i, file)}
                                />
                                <PickHalf
                                    icon="gallery"
                                    label="Gallery"
                                    disabled={uploading}
                                    onFile={(file) => void replace(i, file)}
                                />
                            </div>
                        )}
                        {url ? (
                            <button
                                type="button"
                                aria-label="Remove card"
                                className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                                onClick={() => remove(i)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}

function PickHalf({
    icon,
    label,
    capture,
    disabled,
    onFile,
}: {
    icon: "camera" | "gallery"
    label: string
    capture?: boolean | "user" | "environment"
    disabled?: boolean
    onFile: (file: File) => void
}) {
    return (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-0.5 border-r border-border/60 last:border-r-0">
            {icon === "gallery" ? <Images className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            <span className="text-[9px] font-medium">{label}</span>
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture={capture === true ? "environment" : capture || undefined}
                className="sr-only"
                disabled={disabled}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (file) onFile(file)
                }}
            />
        </label>
    )
}
