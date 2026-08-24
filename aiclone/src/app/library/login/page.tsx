"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestLibraryLink } from "@/app/actions/library"
import { AuthShell } from "@/components/auth/auth-shell"

export default function LibraryLoginPage() {
    return (
        <Suspense>
            <LibraryLoginForm />
        </Suspense>
    )
}

function LibraryLoginForm() {
    const params = useSearchParams()
    const [email, setEmail] = useState("")
    const [sent, setSent] = useState(false)
    const [busy, setBusy] = useState(false)
    const expired = params.get("error") === "expired"

    return (
        <AuthShell
            title="Welcome back"
            subtitle="We’ll email a link. No password."
        >
            <div className="space-y-4">
                {expired && <p className="text-sm text-amber-300">That link expired. Ask for a new one.</p>}
                {sent ? (
                    <p className="text-sm text-zinc-300">If that email has a library, the link is on its way.</p>
                ) : (
                    <form
                        className="space-y-3"
                        onSubmit={async (e) => {
                            e.preventDefault()
                            setBusy(true)
                            try {
                                await requestLibraryLink(email)
                                setSent(true)
                            } finally {
                                setBusy(false)
                            }
                        }}
                    >
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Email</Label>
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@email.com"
                                className="h-11 rounded-full border-white/10 bg-white/[0.06] text-[16px] text-white placeholder:text-zinc-500"
                            />
                        </div>
                        <Button
                            className="h-11 w-full rounded-full bg-[#00D7FF] font-semibold text-[#061018] hover:bg-[#5ee7ff]"
                            disabled={busy || !email.includes("@")}
                        >
                            {busy ? "Sending..." : "Email me a link"}
                        </Button>
                    </form>
                )}
            </div>
        </AuthShell>
    )
}
