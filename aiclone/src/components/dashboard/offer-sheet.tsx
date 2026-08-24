"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function OfferSheet({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    footer: React.ReactNode
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-border/70 p-0"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-3">
                        <SheetHeader className="space-y-1 p-0 text-left">
                            <SheetTitle className="text-lg">{title}</SheetTitle>
                            {description ? <SheetDescription>{description}</SheetDescription> : null}
                        </SheetHeader>
                        {children}
                    </div>
                    <div className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur">
                        {footer}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

export function OfferFooter({
    onCancel,
    busy,
    disabled,
    label,
}: {
    onCancel: () => void
    busy?: boolean
    disabled?: boolean
    label: string
}) {
    return (
        <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={onCancel}>
                Cancel
            </Button>
            <Button type="submit" className="h-11 flex-[1.4] rounded-full" disabled={busy || disabled}>
                {busy ? "Saving..." : label}
            </Button>
        </div>
    )
}

export function MoreToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-2xl px-1 py-1 text-sm font-medium">
            More
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
    )
}

export function PillRow<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T
    onChange: (value: T) => void
    options: { id: T; label: string }[]
}) {
    return (
        <div className={cn("grid gap-1.5", options.length <= 2 ? "grid-cols-2" : options.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange(opt.id)}
                    className={cn(
                        "h-9 rounded-xl text-[13px] font-medium",
                        value === opt.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

export function LiveRow({
    checked,
    onChange,
    label = "Live now",
}: {
    checked: boolean
    onChange: (on: boolean) => void
    label?: string
}) {
    return (
        <label className="flex h-12 items-center justify-between rounded-2xl bg-muted/50 px-3.5 text-sm">
            {label}
            <Switch checked={checked} onCheckedChange={onChange} />
        </label>
    )
}

export async function uploadOne(file: File) {
    const body = new FormData()
    body.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body })
    const json = await res.json()
    return (json.url as string | undefined) || null
}
