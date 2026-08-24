"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addProductReview } from "@/app/actions/products"
import { toast } from "sonner"

export function ReviewForm({ productId }: { productId: string }) {
    const [name, setName] = useState("")
    const [rating, setRating] = useState(5)
    const [text, setText] = useState("")
    const [busy, setBusy] = useState(false)
    return (
        <form
            className="space-y-2 rounded-2xl border border-white/8 p-3"
            onSubmit={async (e) => {
                e.preventDefault()
                if (!name.trim()) return
                setBusy(true)
                try {
                    await addProductReview({ productId, rating, text, visitorName: name.trim() })
                    toast.success("Thanks")
                    setText("")
                } catch {
                    toast.error("Could not post")
                } finally {
                    setBusy(false)
                }
            }}
        >
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Leave a review</p>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} className="text-lg text-amber-300">
                        {n <= rating ? "★" : "☆"}
                    </button>
                ))}
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-9 bg-zinc-900" />
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Optional" className="bg-zinc-900" />
            <Button type="submit" size="sm" className="rounded-full" disabled={busy || !name.trim()}>
                {busy ? "..." : "Post"}
            </Button>
        </form>
    )
}
