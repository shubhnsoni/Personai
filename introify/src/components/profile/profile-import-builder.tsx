"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { applyProfileImport, generateProfileImport, getProfileImportByRequest } from "@/app/actions/profile-import"
import { PROFILE_IMPORT_POLICY, profileBlueprintSchema, type ProfileBlueprint, type ProfileImportContext, type ProfileImportInput, type ProfileImportPreview } from "@/lib/profile-import-contract"
import { ADDONS, NEEDS, type NeedId } from "@/lib/onboarding-needs"
import { cn } from "@/lib/utils"

function newRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = crypto.getRandomValues(new Uint8Array(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x40
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("")
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
    throw new Error("This browser cannot create a secure request id.")
}

const inputClass = "w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
const labelClass = "text-xs font-medium text-muted-foreground"

function Badge({ tone, children }: { tone: "read" | "warn" | "muted"; children: React.ReactNode }) {
    return (
        <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            tone === "read" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : tone === "warn" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-muted text-muted-foreground",
        )}>{children}</span>
    )
}

function Citations({ ids }: { ids: string[] }) {
    if (!ids.length) return null
    return <span className="inline-flex gap-1">{ids.map(id => <span key={id} className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{id}</span>)}</span>
}

function PriceField({ value, currency, onChange, disabled }: { value: number | null; currency: string; onChange: (v: number | null) => void; disabled?: boolean }) {
    return (
        <input
            aria-label="Price"
            inputMode="decimal"
            value={value === null ? "" : String(value)}
            placeholder={value === null ? "Set price" : undefined}
            disabled={disabled}
            onChange={(e) => {
                const raw = e.target.value.trim()
                if (!raw) { onChange(null); return }
                const n = Number(raw)
                if (Number.isFinite(n) && n >= 0) onChange(n)
            }}
            className={cn(inputClass, "w-28")}
            title={currency}
        />
    )
}

function Field({ label, value, onChange, disabled, multiline, ariaLabel }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; multiline?: boolean; ariaLabel?: string }) {
    return (
        <label className="block space-y-1">
            <span className={labelClass}>{label}</span>
            {multiline
                ? <textarea aria-label={ariaLabel || label} rows={3} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cn(inputClass, "resize-y")} />
                : <input aria-label={ariaLabel || label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={inputClass} />}
        </label>
    )
}

export function ProfileImportBuilder({
    context,
    onUse,
    onCancel,
}: {
    context: ProfileImportContext
    onUse?: (preview: ProfileImportPreview, draft: ProfileBlueprint) => void
    onCancel?: () => void
}) {
    const router = useRouter()
    const [linksText, setLinksText] = useState("")
    const [pasted, setPasted] = useState("")
    const [discover, setDiscover] = useState(true)
    const [consent, setConsent] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<string[]>([])
    const [preview, setPreview] = useState<ProfileImportPreview | null>(null)
    const [draft, setDraft] = useState<ProfileBlueprint | null>(null)
    const [overwrite, setOverwrite] = useState(false)
    const [applyFeatures, setApplyFeatures] = useState(true)
    const [applied, setApplied] = useState<{ profileId: string; slug: string } | null>(null)
    const isDashboard = "profileId" in context
    const storageKey = `pi-request:${isDashboard ? context.profileId : "onboarding"}`
    const requestId = useRef((() => {
        try {
            const saved = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(storageKey) : null
            if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved
        } catch { }
        const created = newRequestId()
        try { sessionStorage?.setItem(storageKey, created) } catch { }
        return created
    })())
    const submittedInput = useRef<ProfileImportInput | null>(null)
    const generating = useRef(false)
    function rotateRequestId() {
        requestId.current = newRequestId()
        try { sessionStorage?.setItem(storageKey, requestId.current) } catch { }
    }

    function currentInput(): ProfileImportInput {
        return {
            requestId: requestId.current,
            links: linksText.split("\n").map(l => l.trim()).filter(Boolean),
            text: pasted,
            discover,
        }
    }

    function inputChanged(input: ProfileImportInput): boolean {
        const last = submittedInput.current
        if (!last) return false
        return JSON.stringify({ links: last.links, text: last.text, discover: last.discover })
            !== JSON.stringify({ links: input.links, text: input.text, discover: input.discover })
    }

    async function generate() {
        if (busy || generating.current) return
        const input = currentInput()

        if (inputChanged(input)) rotateRequestId()
        input.requestId = requestId.current
        submittedInput.current = input
        generating.current = true
        setBusy(true)
        setError(null)
        try {
            const result = await generateProfileImport(context, input)
            setPreview(result)
            setDraft(result.draft)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Import failed. Your text and links are kept below.")
        } finally {
            generating.current = false
            setBusy(false)
        }
    }

    async function checkSavedResult() {
        if (busy || generating.current) return
        generating.current = true
        setBusy(true)
        try {
            const result = await getProfileImportByRequest(context, requestId.current)
            if (!result) { setError("No saved result yet — that generation is still running or did not reach the server."); return }
            setPreview(result)
            setDraft(result.draft)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : "No saved result yet.")
        } finally {
            generating.current = false
            setBusy(false)
        }
    }

    function reset(keepInputs = true) {
        rotateRequestId()
        submittedInput.current = null
        setPreview(null)
        setDraft(null)
        setApplied(null)
        setError(null)
        setFieldErrors([])
        if (!keepInputs) { setLinksText(""); setPasted(""); setConsent(false) }
    }

    function addCandidate(url: string) {
        rotateRequestId()
        submittedInput.current = null
        setLinksText(cur => `${cur}${cur.trim() ? "\n" : ""}${url}`)
        setPreview(null)
        setDraft(null)
        setError(null)
    }

    function update(fn: (d: ProfileBlueprint) => ProfileBlueprint) {
        setFieldErrors([])
        setDraft(cur => (cur ? fn(structuredClone(cur)) : cur))
    }

    function checkedDraft(): ProfileBlueprint | null {
        if (!draft) return null
        const result = profileBlueprintSchema.safeParse(draft)
        if (result.success) { setFieldErrors([]); return result.data }
        setFieldErrors(result.error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "draft"}: ${issue.message}`))
        return null
    }

    async function apply() {
        if (!preview || busy) return
        const reviewed = checkedDraft()
        if (!reviewed) return
        setBusy(true)
        setError(null)
        try {
            const result = await applyProfileImport((context as { profileId: string }).profileId, preview.id, reviewed, { overwriteProfile: overwrite, applyFeatures })
            setApplied(result)
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not apply the draft.")
        } finally {
            setBusy(false)
        }
    }

    function use() {
        if (!preview) return
        const reviewed = checkedDraft()
        if (reviewed) onUse?.(preview, reviewed)
    }

    const candidates = preview?.sources.filter(s => s.status === "candidate") || []

    return (
        <div className="space-y-4" data-testid="profile-import-builder">
            {!preview ? (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                    <div>
                        <p className="text-sm font-medium">Import your full profile</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Add public profile links or paste a whole page. We read only public pages and never store raw page HTML.</p>
                    </div>
                    <label className="block space-y-1.5">
                        <span className={labelClass}>Profile links (up to {PROFILE_IMPORT_POLICY.maxLinks}, one per line)</span>
                        <textarea
                            aria-label="Profile links"
                            rows={3}
                            value={linksText}
                            disabled={busy}
                            onChange={(e) => setLinksText(e.target.value)}
                            placeholder={"https://www.linkedin.com/in/you\nhttps://github.com/you"}
                            className={cn(inputClass, "resize-y")}
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className={labelClass}>Or paste the full page text</span>
                        <textarea
                            aria-label="Pasted page text"
                            rows={6}
                            value={pasted}
                            disabled={busy}
                            onChange={(e) => setPasted(e.target.value)}
                            placeholder="Paste everything from your profile or about page…"
                            className={cn(inputClass, "resize-y")}
                        />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={discover} disabled={busy} onChange={(e) => setDiscover(e.target.checked)} />
                        Also look for linked social profiles on these pages
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} />
                        <span>These are my profiles or I have permission to import them.</span>
                    </label>
                    {error ? (
                        <div role="alert" className="space-y-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <p>{error}</p>
                            <button type="button" disabled={busy} onClick={() => void checkSavedResult()} className="rounded-full border border-destructive/40 px-3 py-1 text-xs">
                                Check saved result
                            </button>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={busy || !consent || (!linksText.trim() && !pasted.trim())}
                            onClick={() => void generate()}
                            className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40"
                        >
                            {busy ? "Generating…" : `Generate full profile · ${PROFILE_IMPORT_POLICY.credits} credits`}
                        </button>
                        {error || submittedInput.current ? (
                            <button type="button" disabled={busy} onClick={() => reset()} className="h-10 rounded-full border border-border/70 px-4 text-sm">New generation</button>
                        ) : null}
                        {onCancel ? (
                            <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-full border border-border/70 px-4 text-sm">Cancel</button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {preview && draft ? (
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        {preview.sources.map(source => (
                            <div key={source.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                                <Badge tone={source.status === "read" ? "read" : source.status === "candidate" ? "muted" : "warn"}>
                                    {source.label}{source.status === "candidate" ? " · candidate" : source.status === "blocked" ? " · blocked" : source.status === "failed" ? " · failed" : ""}
                                </Badge>
                                {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="max-w-full truncate text-muted-foreground underline-offset-2 hover:underline">{source.url}</a> : null}
                                {source.discoveredFrom ? <span className="text-muted-foreground">found on {source.discoveredFrom}</span> : null}
                                {source.warning ? <span className="text-amber-700 dark:text-amber-300">{source.warning}</span> : null}
                            </div>
                        ))}
                    </div>
                    {preview.warnings.length ? (
                        <ul className="space-y-1 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    ) : null}
                    {candidates.length ? (
                        <div className="space-y-1.5 rounded-xl border border-border/60 p-3">
                            <p className="text-xs font-medium text-muted-foreground">Possible profiles found on your pages — not imported yet</p>
                            {candidates.map(c => (
                                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="truncate">{c.url}</span>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        className="shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-xs"
                                        onClick={() => addCandidate(c.url || "")}
                                    >Add to links</button>
                                </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground">Added links join your next generation&apos;s submitted list.</p>
                        </div>
                    ) : null}

                    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                        <p className="text-sm font-medium">Profile <Citations ids={draft.profile.sourceIds} /></p>
                        <Field label="Name" value={draft.profile.displayName} disabled={busy} onChange={v => update(d => { d.profile.displayName = v; return d })} />
                        <Field label="Headline" value={draft.profile.headline} disabled={busy} onChange={v => update(d => { d.profile.headline = v; return d })} />
                        <Field label="Bio" value={draft.profile.bio} disabled={busy} multiline onChange={v => update(d => { d.profile.bio = v; return d })} />
                        <Field label="Assistant welcome" value={draft.profile.welcome} disabled={busy} onChange={v => update(d => { d.profile.welcome = v; return d })} />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                        <p className="text-sm font-medium">Features</p>
                        <label className="block space-y-1"><span className={labelClass}>Profile type</span>
                            <select aria-label="Profile type" value={draft.needId} disabled={busy} onChange={e => update(d => { d.needId = e.target.value as NeedId; return d })} className={inputClass}>
                                {NEEDS.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                            </select></label>
                        {isDashboard ? <p className="text-[11px] text-muted-foreground">Recommended type only — applying does not replace your current kit.</p> : null}
                        <div className="flex flex-wrap gap-2">
                            {ADDONS.map(a => (
                                <button key={a.id} type="button"
                                    aria-pressed={draft.addons.includes(a.id)}
                                    disabled={busy}
                                    onClick={() => update(d => { d.addons = d.addons.includes(a.id) ? d.addons.filter(x => x !== a.id) : [...d.addons, a.id]; return d })}
                                    className={cn("rounded-full border px-3 py-1.5 text-xs", draft.addons.includes(a.id) ? "border-foreground bg-foreground text-background" : "border-border/70 text-muted-foreground")}>
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {draft.experiences.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Experience</p>
                            {draft.experiences.map((exp, i) => (
                                <div key={i} className="space-y-1.5 rounded-xl border border-border/50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <Citations ids={exp.sourceIds} />
                                        <button type="button" aria-label={`Remove experience ${exp.role}`} disabled={busy} className="text-xs text-muted-foreground" onClick={() => update(d => { d.experiences.splice(i, 1); return d })}>Remove</button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Field label="Role" value={exp.role} disabled={busy} onChange={v => update(d => { d.experiences[i].role = v; return d })} />
                                        <Field label="Company" value={exp.company} disabled={busy} onChange={v => update(d => { d.experiences[i].company = v; return d })} />
                                        <Field label="Start" value={exp.startDate} disabled={busy} onChange={v => update(d => { d.experiences[i].startDate = v; return d })} />
                                        <Field label="End (blank = present)" value={exp.endDate || ""} disabled={busy} onChange={v => update(d => { d.experiences[i].endDate = v || null; return d })} />
                                    </div>
                                    <Field label="Description" value={exp.description} disabled={busy} multiline onChange={v => update(d => { d.experiences[i].description = v; return d })} />
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {draft.projects.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Projects</p>
                            {draft.projects.map((p, i) => (
                                <div key={i} className="space-y-1.5 rounded-xl border border-border/50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <Citations ids={p.sourceIds} />
                                        <button type="button" aria-label={`Remove project ${p.title}`} disabled={busy} className="text-xs text-muted-foreground" onClick={() => update(d => { d.projects.splice(i, 1); return d })}>Remove</button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <Field label="Title" value={p.title} disabled={busy} onChange={v => update(d => { d.projects[i].title = v; return d })} />
                                        <Field label="Client" value={p.client || ""} disabled={busy} onChange={v => update(d => { d.projects[i].client = v || null; return d })} />
                                        <Field label="Year" value={p.year || ""} disabled={busy} onChange={v => update(d => { d.projects[i].year = v || null; return d })} />
                                    </div>
                                    <Field label="Description" value={p.description} disabled={busy} multiline onChange={v => update(d => { d.projects[i].description = v; return d })} />
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {draft.services.length || draft.products.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Offers <span className="text-xs font-normal text-muted-foreground">— saved as inactive drafts until you publish them</span></p>
                            {draft.services.map((s, i) => (
                                <div key={`s${i}`} className="space-y-1.5 rounded-xl border border-border/50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Badge tone={s.basis === "sourced" ? "read" : "muted"}>{s.basis === "sourced" ? "From sources" : "Suggested"}</Badge>
                                            <Badge tone="muted">Inactive draft</Badge>
                                            <Citations ids={s.sourceIds} />
                                        </div>
                                        <button type="button" aria-label={`Remove service ${s.title}`} disabled={busy} className="text-xs text-muted-foreground" onClick={() => update(d => { d.services.splice(i, 1); return d })}>Remove</button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <Field label="Title" value={s.title} disabled={busy} onChange={v => update(d => { d.services[i].title = v; return d })} />
                                        <Field label="Duration (min)" value={String(s.durationMinutes)} disabled={busy} onChange={v => update(d => { const n = Number(v); if (Number.isFinite(n) && n > 0) d.services[i].durationMinutes = Math.round(n); return d })} />
                                        <Field label="Currency" value={s.currency} disabled={busy} onChange={v => update(d => { d.services[i].currency = v as typeof s.currency; return d })} />
                                    </div>
                                    <Field label="Description" value={s.description} disabled={busy} multiline onChange={v => update(d => { d.services[i].description = v; return d })} />
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <PriceField value={s.price} currency={s.currency} disabled={busy} onChange={v => update(d => { d.services[i].price = v; return d })} />
                                        <span>{s.currency}{s.price === null ? " · not set" : ""}</span>
                                    </div>
                                </div>
                            ))}
                            {draft.products.map((p, i) => (
                                <div key={`p${i}`} className="space-y-1.5 rounded-xl border border-border/50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Badge tone={p.basis === "sourced" ? "read" : "muted"}>{p.basis === "sourced" ? "From sources" : "Suggested"}</Badge>
                                            <Badge tone="muted">Inactive draft</Badge>
                                            <Citations ids={p.sourceIds} />
                                        </div>
                                        <button type="button" aria-label={`Remove product ${p.title}`} disabled={busy} className="text-xs text-muted-foreground" onClick={() => update(d => { d.products.splice(i, 1); return d })}>Remove</button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Field label="Title" value={p.title} disabled={busy} onChange={v => update(d => { d.products[i].title = v; return d })} />
                                        <Field label="Currency" value={p.currency} disabled={busy} onChange={v => update(d => { d.products[i].currency = v as typeof p.currency; return d })} />
                                    </div>
                                    <Field label="Description" value={p.description} disabled={busy} multiline onChange={v => update(d => { d.products[i].description = v; return d })} />
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <PriceField value={p.price} currency={p.currency} disabled={busy} onChange={v => update(d => { d.products[i].price = v; return d })} />
                                        <span>{p.currency}{p.price === null ? " · not set" : ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {draft.knowledge.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Knowledge</p>
                            {draft.knowledge.map((k, i) => (
                                <div key={i} className="space-y-1.5 rounded-xl border border-border/50 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <Citations ids={k.sourceIds} />
                                        <div className="flex items-center gap-1.5">
                                            <select aria-label={`Visibility for ${k.title}`} value={k.basis === "suggested" ? "PRIVATE" : k.visibility}
                                                disabled={busy || k.basis === "suggested"}
                                                onChange={e => update(d => { d.knowledge[i].visibility = e.target.value as typeof k.visibility; return d })}
                                                className="rounded-lg border border-border/70 bg-background px-2 py-1 text-xs">
                                                <option value="PUBLIC">Public</option>
                                                <option value="CLIENT">Clients</option>
                                                <option value="PRIVATE">Private</option>
                                            </select>
                                            <button type="button" aria-label={`Remove knowledge ${k.title}`} disabled={busy} className="text-xs text-muted-foreground" onClick={() => update(d => { d.knowledge.splice(i, 1); return d })}>Remove</button>
                                        </div>
                                    </div>
                                    {k.basis === "suggested" ? <p className="text-[11px] text-muted-foreground">Suggested outline — stays private until you approve it.</p> : null}
                                    <Field label="Title" value={k.title} disabled={busy} onChange={v => update(d => { d.knowledge[i].title = v; return d })} />
                                    <Field label="Body" value={k.body} disabled={busy} multiline onChange={v => update(d => { d.knowledge[i].body = v; return d })} />
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {draft.frameworks.length || draft.introductions.length ? (
                        <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Drafted for a later step</p>
                            {draft.frameworks.map((f, i) => (
                                <div key={`f${i}`} className="space-y-1 rounded-xl border border-border/50 p-3">
                                    <p className="text-xs font-medium">Checklist draft: {f.title} <Citations ids={f.sourceIds} /></p>
                                    <p className="text-xs text-muted-foreground">{f.description}</p>
                                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                        {f.questions.map(q => <li key={q.id}>{q.label}{q.guidance ? ` — ${q.guidance}` : ""}</li>)}
                                    </ul>
                                </div>
                            ))}
                            {draft.introductions.map((intro, i) => (
                                <div key={`i${i}`} className="space-y-1 rounded-xl border border-border/50 p-3">
                                    <p className="text-xs font-medium">Introduction for “{intro.intent}” <Citations ids={intro.sourceIds} /></p>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{intro.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {draft.missingInformation.length ? (
                        <div className="rounded-2xl border border-border/70 bg-card p-4">
                            <p className="text-sm font-medium">Worth adding later</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                {draft.missingInformation.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    ) : null}

                    {fieldErrors.length ? (
                        <ul role="alert" className="space-y-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {fieldErrors.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                    ) : null}
                    {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
                    {applied ? <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">Applied to your profile. Offers are inactive drafts you can price and publish.</p> : null}

                    <div className="flex flex-wrap items-center gap-3">
                        {isDashboard ? (
                            <>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input type="checkbox" checked={overwrite} disabled={busy} onChange={e => setOverwrite(e.target.checked)} />
                                    Replace my existing name, headline, bio and welcome
                                </label>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input type="checkbox" checked={applyFeatures} disabled={busy} onChange={e => setApplyFeatures(e.target.checked)} />
                                    Enable suggested features
                                </label>
                                <button type="button" disabled={busy || Boolean(applied)} onClick={() => void apply()}
                                    className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">
                                    {busy ? "Applying…" : applied ? "Applied" : "Apply to my profile"}
                                </button>
                            </>
                        ) : (
                            <button type="button" disabled={busy} onClick={use}
                                className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">
                                Use this draft
                            </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => reset()} className="h-10 rounded-full border border-border/70 px-4 text-sm">New generation</button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
