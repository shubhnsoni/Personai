"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getProfileExpertise, getKnowledgeGaps, resolveKnowledgeGaps, saveProfileFramework, saveProfileIntroduction, setKnowledgeGapTracking } from "@/app/actions/profile-expertise"
import { setKnowledgeMemberAccess, setKnowledgePurchaseRule, setKnowledgeVisibility } from "@/app/actions/knowledge-access"
import type { FrameworkDraft } from "@/lib/profile-import-contract"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Expertise = Awaited<ReturnType<typeof getProfileExpertise>>
type GapGroups = Awaited<ReturnType<typeof getKnowledgeGaps>>

export function ProfileExpertiseStudio({ profileId, onAddKnowledge }: { profileId: string; onAddKnowledge?: (title: string) => void }) {
    const [data, setData] = useState<Expertise | null>(null)
    const [gaps, setGaps] = useState<GapGroups | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [grantEmail, setGrantEmail] = useState<Record<string, string>>({})

    const reload = useCallback(async () => {
        try {
            const next = await getProfileExpertise(profileId)
            setData(next)
            if (next.settings.advancedAnalytics && next.settings.knowledgeGapTracking) {
                setGaps(await getKnowledgeGaps(profileId))
            } else {
                setGaps(null)
            }
        } catch {
            toast.error("Could not load expertise tools")
        }
    }, [profileId])

    useEffect(() => { void reload() }, [reload])

    const run = useCallback(async (key: string, work: () => Promise<unknown>, done = "Saved") => {
        setBusy(key)
        try {
            await work()
            toast.success(done)
            await reload()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save")
        } finally {
            setBusy(null)
        }
    }, [reload])

    if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <div>
                    <p className="text-sm font-medium">Self-assessment frameworks</p>
                    <p className="text-xs text-muted-foreground">Drafted from your import. Publishing shows them at /frameworks with equal-weight scoring.</p>
                </div>
                {data.frameworks.length === 0 ? <p className="text-xs text-muted-foreground">No frameworks yet — they appear after a full profile import.</p> : null}
                {data.frameworks.map(framework => (
                    <FrameworkEditor
                        key={framework.id}
                        framework={framework}
                        busy={busy === framework.id}
                        onSave={(definition, publish, scoringApproved) => run(framework.id, () => saveProfileFramework(profileId, framework.id, { definition, publish, scoringApproved }), publish ? "Published framework" : "Saved draft")}
                    />
                ))}
            </section>

            <section className="space-y-3">
                <div>
                    <p className="text-sm font-medium">Intent introductions</p>
                    <p className="text-xs text-muted-foreground">Visitors pick an intent chip to see the matching introduction.</p>
                </div>
                {data.introductions.map(intro => (
                    <IntroductionEditor
                        key={intro.id}
                        intro={intro}
                        busy={busy === intro.id}
                        onSave={(intent, text, publish) => run(intro.id, () => saveProfileIntroduction(profileId, intro.id, { intent, text, publish }), publish ? "Published introduction" : "Saved draft")}
                    />
                ))}
                {data.introductions.length === 0 ? <p className="text-xs text-muted-foreground">No introductions yet.</p> : null}
            </section>

            <section className="space-y-3">
                <div>
                    <p className="text-sm font-medium">Knowledge sharing</p>
                    <p className="text-xs text-muted-foreground">
                        Client-only notes unlock for signed-in members you grant, or after a paid Stripe checkout on a linked product or service.
                        New paid Stripe checkouts unlock linked knowledge; older/offline purchases need an owner grant. Clients use the library login with the same email.
                    </p>
                </div>
                {data.documents.map(doc => (
                    <div key={doc.id} className="space-y-2 rounded-2xl border border-border/70 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {doc.visibility === "PRIVATE" ? "Private" : doc.visibility === "CLIENT" ? "Clients only" : "Public"} · {doc.publicationState === "PUBLISHED" ? "Published" : "Draft"}
                            </span>
                        </div>
                        {doc.publishable ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <select
                                    aria-label="Sharing"
                                    className="h-8 rounded-full border border-border/70 bg-transparent px-2"
                                    value={doc.visibility}
                                    onChange={event => void run(doc.id, () => setKnowledgeVisibility(profileId, doc.id, { visibility: event.target.value as "PUBLIC" | "CLIENT" | "PRIVATE", publicationState: doc.publicationState as "DRAFT" | "PUBLISHED" }))}
                                >
                                    <option value="PUBLIC">Public</option>
                                    <option value="CLIENT">Clients only</option>
                                    <option value="PRIVATE">Private</option>
                                </select>
                                <button
                                    type="button"
                                    aria-pressed={doc.publicationState === "PUBLISHED"}
                                    disabled={busy === doc.id}
                                    onClick={() => void run(doc.id, () => setKnowledgeVisibility(profileId, doc.id, { visibility: doc.visibility as "PUBLIC" | "CLIENT" | "PRIVATE", publicationState: doc.publicationState === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), doc.publicationState === "PUBLISHED" ? "Moved to draft" : "Published")}
                                    className="rounded-full border border-border/70 px-3 py-1"
                                >
                                    {doc.publicationState === "PUBLISHED" ? "Unpublish" : "Publish"}
                                </button>
                            </div>
                        ) : (
                            <p className="text-[10px] text-muted-foreground">Private chat and memory notes cannot be published.</p>
                        )}
                        {doc.visibility === "CLIENT" && doc.publicationState === "PUBLISHED" ? (
                            <div className="space-y-2 border-t border-border/50 pt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        aria-label="Client email"
                                        className="h-8 w-48 rounded-full text-xs"
                                        placeholder="client@email.com"
                                        value={grantEmail[doc.id] || ""}
                                        onChange={event => setGrantEmail(current => ({ ...current, [doc.id]: event.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        disabled={busy === doc.id || !(grantEmail[doc.id] || "").trim()}
                                        onClick={() => void run(doc.id, () => setKnowledgeMemberAccess(profileId, doc.id, { email: grantEmail[doc.id] || "", allow: true, expiresAt: null }), "Access granted")}
                                        className="rounded-full border border-border/70 px-3 py-1 text-xs"
                                    >Grant access</button>
                                    <button
                                        type="button"
                                        disabled={busy === doc.id || !(grantEmail[doc.id] || "").trim()}
                                        onClick={() => void run(doc.id, () => setKnowledgeMemberAccess(profileId, doc.id, { email: grantEmail[doc.id] || "", allow: false, expiresAt: null }), "Access revoked")}
                                        className="rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive"
                                    >Revoke</button>
                                </div>
                                {data.grants.filter(grant => grant.documentId === doc.id).map(grant => (
                                    <p key={grant.id} className="text-[10px] text-muted-foreground">
                                        {grant.member.email} — {grant.state === "ALLOWED" ? "allowed" : "revoked"}{grant.expiresAt ? ` until ${new Date(grant.expiresAt).toLocaleDateString()}` : ""}
                                    </p>
                                ))}
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Unlock after purchase:</span>
                                    {data.offers.products.map(product => {
                                        const active = data.rules.some(rule => rule.documentId === doc.id && rule.productId === product.id)
                                        return (
                                            <button
                                                key={product.id}
                                                type="button"
                                                aria-pressed={active}
                                                disabled={busy === doc.id}
                                                onClick={() => void run(doc.id, () => setKnowledgePurchaseRule(profileId, doc.id, { kind: "PRODUCT", itemId: product.id, enabled: !active }))}
                                                className={cn("rounded-full border px-3 py-1", active ? "border-foreground bg-foreground text-background" : "border-border/70")}
                                            >{product.title}</button>
                                        )
                                    })}
                                    {data.offers.services.map(service => {
                                        const active = data.rules.some(rule => rule.documentId === doc.id && rule.serviceOfferingId === service.id)
                                        return (
                                            <button
                                                key={service.id}
                                                type="button"
                                                aria-pressed={active}
                                                disabled={busy === doc.id}
                                                onClick={() => void run(doc.id, () => setKnowledgePurchaseRule(profileId, doc.id, { kind: "SERVICE", itemId: service.id, enabled: !active }))}
                                                className={cn("rounded-full border px-3 py-1", active ? "border-foreground bg-foreground text-background" : "border-border/70")}
                                            >{service.name}</button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ))}
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium">Questions with no matching knowledge source</p>
                        <p className="text-xs text-muted-foreground">Requires Advanced analytics. Visitors must opt in per conversation; only consented, unanswered questions from the last {30} days, up to {200} recent records.</p>
                    </div>
                    {data.settings.advancedAnalytics ? (
                        <button
                            type="button"
                            aria-pressed={data.settings.knowledgeGapTracking}
                            disabled={busy === "gapTracking"}
                            onClick={() => void run("gapTracking", () => setKnowledgeGapTracking(profileId, !data.settings.knowledgeGapTracking))}
                            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", data.settings.knowledgeGapTracking ? "border-foreground bg-foreground text-background" : "border-border/70")}
                        >{data.settings.knowledgeGapTracking ? "On" : "Off"}</button>
                    ) : (
                        <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">Advanced analytics required</span>
                    )}
                </div>
                {gaps ? (
                    <>
                        <p className="text-[10px] text-muted-foreground">Since {new Date(gaps.since).toLocaleDateString()}{gaps.truncated ? " · showing the most recent records" : ""}. Counts are occurrences in this window only.</p>
                        {gaps.groups.length === 0 ? <p className="text-xs text-muted-foreground">No unanswered questions recorded yet.</p> : null}
                        {gaps.groups.map(group => (
                            <div key={group.signalIds.join(":")} className="space-y-2 rounded-2xl border border-border/70 p-3">
                                <p className="text-sm">{group.question} <span className="text-xs text-muted-foreground">×{group.occurrences}</span></p>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" className="h-8 rounded-full text-xs" disabled={busy === group.signalIds[0]} onClick={() => { onAddKnowledge?.(group.question) }}>
                                        Add knowledge draft
                                    </Button>
                                    <Button type="button" variant="outline" className="h-8 rounded-full text-xs" disabled={busy === group.signalIds[0]} onClick={() => void run(group.signalIds[0], () => resolveKnowledgeGaps(profileId, group.signalIds, "ANSWERED"), "Marked answered")}>
                                        Mark answered
                                    </Button>
                                    <Button type="button" variant="outline" className="h-8 rounded-full text-xs" disabled={busy === group.signalIds[0]} onClick={() => void run(group.signalIds[0], () => resolveKnowledgeGaps(profileId, group.signalIds, "DISMISSED"), "Dismissed")}>
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </>
                ) : null}
            </section>
        </div>
    )
}

function FrameworkEditor({ framework, busy, onSave }: {
    framework: Expertise["frameworks"][number]
    busy: boolean
    onSave: (definition: FrameworkDraft, publish: boolean, scoringApproved: boolean) => void
}) {
    const [draft, setDraft] = useState<FrameworkDraft>(framework.definition as unknown as FrameworkDraft)
    const [scoringApproved, setScoringApproved] = useState(framework.scoringApproved)
    const dirty = JSON.stringify(draft) !== JSON.stringify(framework.definition) || scoringApproved !== framework.scoringApproved

    const updateQuestion = (index: number, patch: Partial<FrameworkDraft["questions"][number]>) => {
        setDraft(current => ({
            ...current,
            questions: current.questions.map((question, i) => i === index ? { ...question, ...patch } : question),
        }))
    }

    return (
        <div className="space-y-2 rounded-2xl border border-border/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Framework title" className="h-9 flex-1 rounded-full" value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{framework.status === "PUBLISHED" ? "Published" : "Draft"}</span>
            </div>
            <Textarea aria-label="Framework description" rows={2} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} className="rounded-2xl text-sm" />
            {draft.questions.map((question, index) => (
                <div key={question.id} className="space-y-1 rounded-xl bg-muted/40 p-2">
                    <div className="flex items-center gap-2">
                        <Input aria-label={`Question ${index + 1}`} className="h-8 flex-1 rounded-full text-xs" value={question.label} onChange={event => updateQuestion(index, { label: event.target.value })} />
                        <button
                            type="button"
                            disabled={draft.questions.length <= 2}
                            onClick={() => setDraft(current => ({ ...current, questions: current.questions.filter((_, i) => i !== index) }))}
                            className="rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] text-destructive"
                        >Remove</button>
                    </div>
                    <Input aria-label={`Guidance ${index + 1}`} className="h-8 rounded-full text-xs" placeholder="Guidance (optional)" value={question.guidance || ""} onChange={event => updateQuestion(index, { guidance: event.target.value })} />
                </div>
            ))}
            {draft.questions.length < 12 ? (
                <button
                    type="button"
                    onClick={() => setDraft(current => ({ ...current, questions: [...current.questions, { id: `q${Date.now().toString(36)}`, label: "", guidance: "" }] }))}
                    className="rounded-full border border-border/70 px-3 py-1 text-xs"
                >Add question</button>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={scoringApproved} onChange={event => setScoringApproved(event.target.checked)} className="mt-0.5" />
                <span>I approve the fixed equal-weight scoring (Yes 2, Partly 1, No 0; Unsure gives no overall score).</span>
            </label>
            <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-8 rounded-full text-xs" disabled={busy || !dirty} onClick={() => onSave(draft, false, scoringApproved)}>
                    Save draft
                </Button>
                <Button type="button" className="h-8 rounded-full text-xs" disabled={busy || !scoringApproved} onClick={() => onSave(draft, true, scoringApproved)}>
                    Publish framework
                </Button>
            </div>
        </div>
    )
}

function IntroductionEditor({ intro, busy, onSave }: {
    intro: Expertise["introductions"][number]
    busy: boolean
    onSave: (intent: string, text: string, publish: boolean) => void
}) {
    const [intent, setIntent] = useState(intro.intent)
    const [text, setText] = useState(intro.text)
    const dirty = intent !== intro.intent || text !== intro.text
    return (
        <div className="space-y-2 rounded-2xl border border-border/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Intent" className="h-9 w-48 rounded-full" value={intent} onChange={event => setIntent(event.target.value)} />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{intro.status === "PUBLISHED" ? "Published" : "Draft"}</span>
            </div>
            <Textarea aria-label="Introduction text" rows={3} value={text} onChange={event => setText(event.target.value)} className="rounded-2xl text-sm" />
            <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-8 rounded-full text-xs" disabled={busy || !dirty} onClick={() => onSave(intent, text, false)}>
                    Save draft
                </Button>
                <Button type="button" className="h-8 rounded-full text-xs" disabled={busy} onClick={() => onSave(intent, text, true)}>
                    Publish introduction
                </Button>
            </div>
        </div>
    )
}
