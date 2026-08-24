"use client"

import { Camera, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function PhotoStage({
    photos,
    active,
    onSelect,
    onRemove,
    onAdd,
    uploading,
    emptyLabel = "Add photos",
    className,
}: {
    photos: string[]
    active: number
    onSelect: (index: number) => void
    onRemove?: (index: number) => void
    onAdd?: (files: File[]) => void
    uploading?: boolean
    emptyLabel?: string
    className?: string
}) {
    return (
        <div className={cn("flex gap-2 overflow-x-auto px-0.5 pt-1.5 pb-1", className)}>
            {photos.map((url, i) => {
                const main = i === active
                return (
                    <div key={url} className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => onSelect(i)}
                            className={cn(
                                "block h-20 rounded-xl bg-muted",
                                main ? "w-20 ring-2 ring-foreground" : "w-11",
                            )}
                        >
                            <img
                                src={url}
                                alt=""
                                className={cn(
                                    "h-20",
                                    main ? "w-20 rounded-xl object-contain p-1" : "w-11 rounded-xl object-cover",
                                )}
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
                <AddSlot
                    uploading={uploading}
                    label={photos.length ? "Add" : emptyLabel}
                    onAdd={onAdd}
                    className={cn("h-20", photos.length ? "w-11" : "w-20")}
                />
            ) : null}
        </div>
    )
}

function AddSlot({
    onAdd,
    uploading,
    label,
    className,
}: {
    onAdd?: (files: File[]) => void
    uploading?: boolean
    label: string
    className?: string
}) {
    if (!onAdd) return null
    return (
        <label
            className={cn(
                "relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground",
                className,
            )}
        >
            <Camera className="h-4 w-4" />
            <span className="px-0.5 text-center text-[10px] font-medium leading-tight">{uploading ? "…" : label}</span>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
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
