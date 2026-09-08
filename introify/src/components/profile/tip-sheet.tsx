"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { placeTip } from "@/app/actions/products"
import { whatsappHref } from "@/lib/commerce"

export function TipSheet({
    profileId,
    displayName,
    upiId,
    whatsapp,
    onClose,
}: {
    profileId: string
    displayName: string
    upiId?: string | null
    whatsapp?: string | null
    onClose: () => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [amount, setAmount] = useState("100")
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState<string | null>(null)

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
            <button type="button" className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-zinc-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-medium">Tip {displayName}</h2>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {done ? (
                    <p className="text-sm text-zinc-200">{done}</p>
                ) : (
                    <form
                        className="space-y-3"
                        onSubmit={async (e) => {
                            e.preventDefault()
                            if (!name.trim() || !email.includes("@")) return
                            setBusy(true)
                            try {
                                const rupees = parseFloat(amount) || 100
                                const tip = await placeTip({
                                    profileId,
                                    visitorName: name.trim(),
                                    visitorEmail: email.trim(),
                                    amountCents: Math.round(rupees * 100),
                                })
                                const wa = whatsappHref(whatsapp || tip.whatsapp, `Tip for ${displayName}: ${rupees} from ${name.trim()}`)
                                if (upiId || tip.upiId) {
                                    setDone(`Pay ${rupees} to ${upiId || tip.upiId}. They’ll see it in Sales.`)
                                } else if (wa) {
                                    window.open(wa, "_blank")
                                    setDone("WhatsApp opened with your tip note.")
                                } else {
                                    setDone("Tip noted. Add UPI on the profile so people can pay.")
                                }
                            } finally {
                                setBusy(false)
                            }
                        }}
                    >
                        <div className="flex gap-2">
                            {["50", "100", "200", "500"].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setAmount(n)}
                                    className={`h-9 flex-1 rounded-full text-xs ${amount === n ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <Button className="h-11 w-full rounded-full" disabled={busy || !name.trim()}>
                            {busy ? "..." : "Send tip"}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
