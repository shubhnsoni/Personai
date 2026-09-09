"use client"

import { useState, useTransition, type ReactNode } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function AdminConfirm({
    title,
    description,
    confirmLabel = "Confirm",
    onConfirm,
    children,
}: {
    title: string
    description: string
    confirmLabel?: string
    onConfirm: () => void | Promise<void>
    children: ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [pending, start] = useTransition()

    return (
        <>
            <span
                role="button"
                tabIndex={0}
                onClick={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setOpen(true)
                    }
                }}
            >
                {children}
            </span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={pending}
                            onClick={() => start(async () => {
                                await onConfirm()
                                setOpen(false)
                            })}
                        >
                            {pending ? "Working…" : confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
