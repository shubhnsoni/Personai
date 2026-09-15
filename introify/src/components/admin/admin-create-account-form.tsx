"use client"

import { useState } from "react"
import Link from "@/components/navigation/transition-link"
import { createAdminAccount } from "@/app/actions/admin"
import { NEEDS } from "@/lib/onboarding-needs"
import { Button } from "@/components/ui/button"

const fieldClass = "mt-1 h-9 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm"
const areaClass = "mt-1 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm"

export function AdminCreateAccountForm() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [slug, setSlug] = useState("")
    const [phone, setPhone] = useState("")
    const [bio, setBio] = useState("")
    const [needId, setNeedId] = useState("page")
    const [links, setLinks] = useState("")
    const [importText, setImportText] = useState("")
    const [runImport, setRunImport] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<{
        userId: string
        slug: string
        publicPath: string
        createdUser: boolean
        createdProfile: boolean
        importStatus?: string
        importError?: string
    } | null>(null)

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault()
        if (busy) return
        if (!email.trim()) {
            setError("Enter an email address.")
            return
        }
        setBusy(true)
        setError(null)
        setResult(null)
        try {
            const created = await createAdminAccount({
                email: email.trim(),
                name: name.trim() || undefined,
                displayName: displayName.trim() || undefined,
                slug: slug.trim() || undefined,
                phone: phone.trim() || undefined,
                bio: bio.trim() || undefined,
                needId,
                importLinks: links.split("\n").map(line => line.trim()).filter(Boolean),
                importText,
                runImport,
            })
            if (!created.ok) {
                setError(created.error)
                return
            }
            setResult({
                userId: created.userId,
                slug: created.slug,
                publicPath: created.publicPath,
                createdUser: created.createdUser,
                createdProfile: created.createdProfile,
                importStatus: created.import?.status,
                importError: created.import?.error,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Could not create that account."
            setError(/prisma|sql|digest/i.test(message) ? "Could not create that account. Check the email and try again." : message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-muted-foreground">
                    Email
                    <input aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} autoComplete="off" />
                </label>
                <label className="block text-xs text-muted-foreground">
                    Name
                    <input aria-label="Name" value={name} onChange={e => setName(e.target.value)} className={fieldClass} />
                </label>
                <label className="block text-xs text-muted-foreground">
                    Display name
                    <input aria-label="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} className={fieldClass} />
                </label>
                <label className="block text-xs text-muted-foreground">
                    Username (optional)
                    <input aria-label="Username" value={slug} onChange={e => setSlug(e.target.value)} className={fieldClass} placeholder="auto from display name" />
                </label>
                <label className="block text-xs text-muted-foreground">
                    Phone
                    <input aria-label="Phone" value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass} />
                </label>
                <label className="block text-xs text-muted-foreground">
                    Business type
                    <select aria-label="Business type" value={needId} onChange={e => setNeedId(e.target.value)} className={fieldClass}>
                        {NEEDS.map(need => <option key={need.id} value={need.id}>{need.title}</option>)}
                    </select>
                </label>
            </div>
            <label className="block text-xs text-muted-foreground">
                About
                <textarea aria-label="About" rows={4} value={bio} onChange={e => setBio(e.target.value)} className={areaClass} />
            </label>
            <label className="block text-xs text-muted-foreground">
                Profile links
                <textarea aria-label="Profile links" rows={3} value={links} onChange={e => setLinks(e.target.value)} className={areaClass} placeholder="One public https link per line" />
            </label>
            <label className="block text-xs text-muted-foreground">
                Pasted profile text
                <textarea aria-label="Pasted profile text" rows={5} value={importText} onChange={e => setImportText(e.target.value)} className={areaClass} />
            </label>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={runImport} onChange={e => setRunImport(e.target.checked)} aria-label="Run profile import now" />
                Run profile import now
            </label>
            {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            {result ? (
                <div className="space-y-2 rounded-xl bg-emerald-500/10 px-3 py-3 text-sm">
                    <p>Account ready{result.createdUser ? " (new login)" : " (existing email updated)"}.</p>
                    <div className="flex flex-wrap gap-3">
                        <Link href={`/admin/users/${result.userId}`} className="underline">Admin record</Link>
                        <Link href={result.publicPath} className="underline">Public page</Link>
                    </div>
                    {result.importStatus === "FAILED" && result.importError ? <p className="text-destructive">{result.importError}</p> : null}
                </div>
            ) : null}
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
        </form>
    )
}
