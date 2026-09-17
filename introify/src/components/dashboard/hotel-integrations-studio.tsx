"use client"

import { useState, useTransition } from "react"
import { saveHotelWebhook } from "@/app/actions/hotels"
import { HOTEL_INTEGRATION_ADAPTERS, hotelWebhookReady } from "@/lib/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"

export function HotelIntegrationsStudio({
    webhookUrl,
    canWrite,
}: {
    webhookUrl: string | null
    canWrite: boolean
}) {
    const [pending, start] = useTransition()
    const [url, setUrl] = useState(webhookUrl || "")
    const [message, setMessage] = useState("")
    const status = hotelWebhookReady(url)
    return (
        <div className="space-y-4">
            {HOTEL_INTEGRATION_ADAPTERS.map((adapter) => (
                <StudioPanel key={adapter.id} className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">{adapter.status}</p>
                            <p className="mt-1 text-sm font-medium">{adapter.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{adapter.summary}</p>
                        </div>
                    </div>
                    {adapter.id === "webhook" ? (
                        <form
                            className="mt-4 space-y-3"
                            onSubmit={(event) => {
                                event.preventDefault()
                                start(async () => {
                                    try {
                                        await saveHotelWebhook(url)
                                        setMessage(hotelWebhookReady(url).ready ? "Placeholder saved. Nothing is delivered yet." : "Webhook cleared.")
                                    } catch (error) {
                                        setMessage(error instanceof Error ? error.message : "Could not save webhook.")
                                    }
                                })
                            }}
                        >
                            <label className="block text-xs text-muted-foreground">
                                HTTPS endpoint
                                <input
                                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-sm text-foreground"
                                    value={url}
                                    disabled={!canWrite || pending}
                                    placeholder="https://example.test/hooks/hotel"
                                    onChange={(event) => setUrl(event.target.value)}
                                    autoComplete="off"
                                />
                            </label>
                            <p className="text-xs text-muted-foreground">
                                {status.ready ? "Ready as a placeholder. PMS/POS/WhatsApp stay stubs — no vendor keys." : "Leave blank until you have an HTTPS callback. Secrets and vendor logins are refused."}
                            </p>
                            {canWrite ? (
                                <button
                                    type="submit"
                                    disabled={pending}
                                    className="inline-flex h-11 min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-sm font-medium text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
                                >
                                    {pending ? "Saving…" : "Save webhook"}
                                </button>
                            ) : null}
                            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
                        </form>
                    ) : (
                        <p className="mt-3 text-xs text-muted-foreground">No credentials. Adapter interface only.</p>
                    )}
                </StudioPanel>
            ))}
        </div>
    )
}
