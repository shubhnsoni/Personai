"use client"

import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export function FileField({
    accept,
    capture,
    disabled,
    onFile,
    buttonLabel = "Choose file",
    emptyLabel = "No file selected",
    className,
}: {
    accept?: string
    capture?: boolean | "user" | "environment"
    disabled?: boolean
    onFile: (file: File | undefined) => void
    buttonLabel?: string
    emptyLabel?: string
    className?: string
}) {
    const id = useId()
    const [name, setName] = useState<string | null>(null)

    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <input
                id={id}
                type="file"
                accept={accept}
                capture={capture === true ? "environment" : capture || undefined}
                disabled={disabled}
                className="sr-only"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    setName(file?.name ?? null)
                    onFile(file)
                    e.target.value = ""
                }}
            />
            <label
                htmlFor={id}
                className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-foreground px-3.5 text-sm font-medium text-background",
                    disabled && "pointer-events-none opacity-50",
                )}
            >
                {disabled ? "Uploading..." : buttonLabel}
            </label>
            <span className="min-w-0 truncate text-sm text-muted-foreground">{name || emptyLabel}</span>
        </div>
    )
}
