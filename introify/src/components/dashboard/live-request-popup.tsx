"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { respondLiveChat } from "@/app/actions/inbox"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type LiveRequest = {
    id: string
    visitorName: string
    message: string
    requestedAt: string | null
}

export function LiveRequestPopup() {
    const pathname = usePathname()
    const router = useRouter()
    const [pending, start] = useTransition()
    const [requests, setRequests] = useState<LiveRequest[]>([])
    const [dismissed, setDismissed] = useState<string[]>([])

    useEffect(() => {
        if (pathname === "/dashboard/inbox") return
        let alive = true
        const load = async () => {
            try {
                const res = await fetch("/api/live/pending", { credentials: "include" })
                if (!res.ok) return
                const data = await res.json()
                if (alive && Array.isArray(data.requests)) setRequests(data.requests)
            } catch {
                // ignore poll failures
            }
        }
        void load()
        const tick = setInterval(load, 4000)
        return () => {
            alive = false
            clearInterval(tick)
        }
    }, [pathname])

    const current = requests.find((row) => !dismissed.includes(row.id)) || null
    const open = Boolean(current) && pathname !== "/dashboard/inbox"

    const act = (accept: boolean) => {
        if (!current) return
        const id = current.id
        start(async () => {
            try {
                await respondLiveChat(id, accept)
                setRequests((rows) => rows.filter((row) => row.id !== id))
                if (accept) router.push(`/dashboard/inbox?c=${id}`)
                else router.refresh()
            } catch {
                // keep the popup so they can retry
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!next && current) setDismissed((ids) => [...ids, current.id])
        }}>
            <DialogContent showCloseButton className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Live chat request</DialogTitle>
                    <DialogDescription>
                        {current?.visitorName || "A visitor"} wants you to join the chat.
                    </DialogDescription>
                </DialogHeader>
                {current?.message ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-zinc-100">
                        “{current.message}”
                    </p>
                ) : null}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-white/15 bg-transparent text-zinc-100"
                        disabled={pending}
                        onClick={() => act(false)}
                    >
                        Reject
                    </Button>
                    <Button
                        type="button"
                        className="bg-[#00D7FF] text-[#061018] hover:bg-[#5ee7ff]"
                        disabled={pending}
                        onClick={() => act(true)}
                    >
                        Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
