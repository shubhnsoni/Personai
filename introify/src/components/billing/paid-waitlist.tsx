"use client"

import { useId, useState } from "react"
import { fill, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"
import type { BillingCadence, PlanId } from "@/lib/billing/catalog"

export function PaidWaitlistButton({
    planId,
    planName,
    cadence,
    locale = "en",
}: {
    planId: PlanId
    planName: string
    cadence: BillingCadence
    locale?: UiLocale
}) {
    const copy = messagesFor(locale).pricing
    const [open, setOpen] = useState(false)
    return (
        <>
            <button className="billing-button" type="button" onClick={() => setOpen(true)}>
                {fill(copy.notifyPlan, { name: planName })}
            </button>
            {open ? (
                <PaidWaitlistDialog
                    planId={planId}
                    planName={planName}
                    cadence={cadence}
                    locale={locale}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    )
}

function PaidWaitlistDialog({
    planId,
    planName,
    cadence,
    locale,
    onClose,
}: {
    planId: PlanId
    planName: string
    cadence: BillingCadence
    locale: UiLocale
    onClose: () => void
}) {
    const copy = messagesFor(locale).pricing
    const id = useId()
    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle")
    const [error, setError] = useState("")

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setStatus("sending")
        setError("")
        try {
            const res = await fetch("/api/platform/waitlist", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, plan: planId, cadence, company: "" }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setStatus("err")
                setError(typeof data.error === "string" ? data.error : copy.waitlistError)
                return
            }
            setStatus("ok")
        } catch {
            setStatus("err")
            setError(copy.waitlistError)
        }
    }

    return (
        <div className="waitlist-layer" role="presentation" onClick={onClose}>
            <div
                className="waitlist-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={id}
                onClick={event => event.stopPropagation()}
            >
                <h2 id={id}>{fill(copy.waitlistTitle, { name: planName })}</h2>
                <p>{copy.waitlistLead}</p>
                {status === "ok" ? (
                    <p className="waitlist-success" role="status">{copy.waitlistSuccess}</p>
                ) : (
                    <form onSubmit={submit}>
                        <label>
                            {copy.waitlistEmail}
                            <input
                                type="email"
                                name="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={event => setEmail(event.target.value)}
                            />
                        </label>
                        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="waitlist-honeypot" aria-hidden="true" />
                        {error ? <p className="waitlist-error" role="alert">{error}</p> : null}
                        <button className="billing-button" type="submit" disabled={status === "sending"}>
                            {status === "sending" ? copy.waitlistSending : copy.waitlistSubmit}
                        </button>
                    </form>
                )}
                <button className="waitlist-close" type="button" onClick={onClose}>{copy.waitlistClose}</button>
            </div>
        </div>
    )
}
