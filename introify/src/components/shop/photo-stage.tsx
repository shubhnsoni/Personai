"use client"

import { Camera, Images, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function PhotoStage({
    photos,
    active,
    onSelect,
    onRemove,
    onAdd,
    uploading,
    emptyLabel = "Add photos",
    hint,
    className,
}: {
    photos: string[]
    active: number
    onSelect: (index: number) => void
    onRemove?: (index: number) => void
    onAdd?: (files: File[]) => void
    uploading?: boolean
    emptyLabel?: string
    hint?: string
    className?: string
}) {
    return (
        <div className="space-y-1.5">
        <div className={cn("flex gap-2 overflow-x-auto px-0.5 pt-1.5 pb-1", className)}>
            {photos.map((url, i) => {
                const main = i === active
                return (
                    <div key={url} className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => onSelect(i)}
                            className={cn(
                                "block size-20 overflow-hidden rounded-xl bg-muted",
                                main ? "ring-2 ring-foreground" : "ring-1 ring-border",
                            )}
                        >
                            <img
                                src={url}
                                alt=""
                                className="size-20 rounded-xl object-cover"
                            />
                        </button>
                        {onRemove ? (
                            <button
                                type="button"
                                aria-label="Remove"
                                className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                                onClick={() => onRemove(i)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        ) : null}
                    </div>
                )
            })}
            {onAdd ? (
                <>
                    <AddSlot
                        uploading={uploading}
                        label={photos.length ? "Camera" : "Take photo"}
                        icon="camera"
                        capture="environment"
                        onAdd={onAdd}
                        className="size-20"
                    />
                    <AddSlot
                        uploading={uploading}
                        label="Gallery"
                        icon="gallery"
                        onAdd={onAdd}
                        className="size-20"
                    />
                </>
            ) : null}
        </div>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        {!photos.length && onAdd ? (
            <p className="sr-only">{emptyLabel}. Take a photo or pick one from the gallery.</p>
        ) : null}
        </div>
    )
}

function AddSlot({
    onAdd,
    uploading,
    label,
    className,
    capture,
    icon,
}: {
    onAdd?: (files: File[]) => void
    uploading?: boolean
    label: string
    className?: string
    capture?: boolean | "user" | "environment"
    icon?: "camera" | "gallery"
}) {
    if (!onAdd) return null
    return (
        <label
            className={cn(
                "relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground",
                className,
            )}
        >
            {icon === "gallery" ? <Images className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            <span className="px-0.5 text-center text-[10px] font-medium leading-tight">{uploading ? "…" : label}</span>
            <input
                type="file"
                accept="image/*"
                capture={capture === true ? "environment" : capture || undefined}
                multiple={!capture}
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    e.target.value = ""
                    if (files.length) onAdd(files)
                }}
            />
        </label>
    )
}
