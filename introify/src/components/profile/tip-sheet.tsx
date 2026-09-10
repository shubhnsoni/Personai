"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { placeTip } from "@/app/actions/products"
import { whatsappHref } from "@/lib/commerce"
import { ProfileStage } from "@/components/profile/profile-stage"

export function TipSheet({
    profileId,
    displayName,
    upiId,
    whatsapp,
    onClose,
    displayMode,
}: {
    profileId: string
    displayName: string
    upiId?: string | null
    whatsapp?: string | null
    onClose: () => void
    displayMode?: string | null
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [amount, setAmount] = useState("100")
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState<string | null>(null)

    return (
        <ProfileStage open onClose={onClose} mode={displayMode} zClass="z-[60]">
            <div className="relative min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
        </ProfileStage>
    )
}
