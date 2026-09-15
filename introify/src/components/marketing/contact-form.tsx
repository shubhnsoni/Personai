"use client"

import { useState } from "react"
import { fill, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

export function ContactForm({ supportEmail, locale = "en" }: { supportEmail: string; locale?: UiLocale }) {
    const copy = messagesFor(locale).chrome.contactForm
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")
    const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle")
    const [error, setError] = useState("")

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setStatus("sending")
        setError("")
        try {
            const res = await fetch("/api/platform/contact", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name, email, message, company: "" }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setStatus("err")
                setError(typeof data.error === "string" ? data.error : copy.error)
                return
            }
            setStatus("ok")
            setMessage("")
        } catch {
            setStatus("err")
            setError(copy.error)
        }
    }

    return (
        <section className="mk-contact-form" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title">{copy.title}</h2>
            <p>{copy.lead}</p>
            {status === "ok" ? (
                <p className="mk-contact-success" role="status">{copy.success}</p>
            ) : (
                <form onSubmit={submit}>
                    <label>
                        {copy.name}
                        <input name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} />
                    </label>
                    <label>
                        {copy.email}
                        <input type="email" name="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
                    </label>
                    <label>
                        {copy.message}
                        <textarea name="message" required minLength={8} rows={5} value={message} onChange={event => setMessage(event.target.value)} />
                    </label>
                    <input type="text" name="company" tabIndex={-1} autoComplete="off" className="mk-contact-honeypot" aria-hidden="true" />
                    {error ? <p className="mk-contact-error" role="alert">{error}</p> : null}
                    <button className="mk-button" type="submit" disabled={status === "sending"}>
                        {status === "sending" ? copy.sending : copy.submit}
                    </button>
                </form>
            )}
            {supportEmail ? (
                <p className="mk-contact-mailto">
                    <a href={`mailto:${supportEmail}`}>{fill(copy.emailCta, { email: supportEmail })}</a>
                </p>
            ) : null}
        </section>
    )
}
