"use client"

import { useState } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addProductReview } from "@/app/actions/products"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function ReviewForm({ productId }: { productId: string }) {
    const router = useRouter()
    const [name, setName] = useState("")
    const [rating, setRating] = useState(5)
    const [text, setText] = useState("")
    const [photo, setPhoto] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onFile(file: File) {
        const body = new FormData()
        body.set("file", file)
        const res = await fetch("/api/upload", { method: "POST", body })
        const data = (await res.json()) as { url?: string }
        if (!data.url) throw new Error("upload")
        setPhoto(data.url)
    }

    return (
        <form
            className="space-y-2 rounded-2xl border border-white/8 p-3"
            onSubmit={async (e) => {
                e.preventDefault()
                if (!name.trim()) return
                setBusy(true)
                try {
                    await addProductReview({
                        productId,
                        rating,
                        text,
                        visitorName: name.trim(),
                        imageUrl: photo || undefined,
                    })
                    toast.success("Thanks")
                    setText("")
                    setPhoto(null)
                    router.refresh()
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
            {photo ? (
                <div className="relative w-24">
                    <img src={photo} alt="" className="h-24 w-24 rounded-xl object-cover" />
                    <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-zinc-950"
                        aria-label="Remove photo"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300">
                    <Camera className="h-3.5 w-3.5" />
                    Add a photo
                    <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ""
                            if (file) void onFile(file).catch(() => toast.error("Could not upload"))
                        }}
                    />
                </label>
            )}
            <Button type="submit" size="sm" className="rounded-full" disabled={busy || !name.trim()}>
                {busy ? "..." : "Post"}
            </Button>
        </form>
    )
}
