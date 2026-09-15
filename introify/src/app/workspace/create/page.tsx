"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

const steps = [
    { key: "goodAt", prompt: "What should this AI be good at?", placeholder: "Logo motion directions, menu notes, brand analysis…", optional: false },
    { key: "process", prompt: "What do you normally do that it should understand?", placeholder: "How you actually work, in a few sentences.", optional: false },
    { key: "input", prompt: "What will someone give it?", placeholder: "A logo file, a night’s sales, a brief…", optional: false },
    { key: "output", prompt: "What should it produce?", placeholder: "Three motion directions, a purchase list, a one-page report…", optional: false },
    { key: "examples", prompt: "Any examples or corrections to start from?", placeholder: "Paste a sample, or skip.", optional: true },
    { key: "name", prompt: "What should we call it?", placeholder: "ANI", optional: false },
] as const

type Answers = Record<(typeof steps)[number]["key"], string>

export default function CreatePage() {
    const router = useRouter()
    const [index, setIndex] = useState(0)
    const [draft, setDraft] = useState("")
    const [answers, setAnswers] = useState<Partial<Answers>>({})
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const step = steps[index]
    const progress = useMemo(() => Array.from({ length: steps.length }, (_, i) => i <= index), [index])

    function applyValue(value: string) {
        const nextAnswers = { ...answers, [step.key]: value }
        setAnswers(nextAnswers)
        setDraft("")
        setError("")
        return nextAnswers
    }

    async function save(nextAnswers: Partial<Answers>) {
        setBusy(true)
        setError("")
        const name = (nextAnswers.name || "My AI").trim()
        const res = await fetch("/api/workspace/creations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name,
                purpose: nextAnswers.goodAt,
                description: nextAnswers.output,
                instructions: [
                    `You are ${name}, a named AI creation on Introify.`,
                    `You are good at: ${nextAnswers.goodAt}`,
                    `How the creator works: ${nextAnswers.process}`,
                    `Someone will give you: ${nextAnswers.input}`,
                    `You should produce: ${nextAnswers.output}`,
                    nextAnswers.examples ? `Examples:\n${nextAnswers.examples}` : "",
                    "Stay inside Read and Create. Do not take financial, destructive, or external actions.",
                ].filter(Boolean).join("\n\n"),
            }),
        })
        const data = await res.json().catch(() => ({}))
        setBusy(false)
        if (!res.ok) {
            setError(data.error || "Could not save this AI.")
            return
        }
        router.push(`/workspace/ai/${data.creation.id}`)
        router.refresh()
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        const value = draft.trim()
        if (!step.optional && value.length < 2) return
        const nextAnswers = applyValue(value)
        if (index < steps.length - 1) {
            setIndex(index + 1)
            setDraft(nextAnswers[steps[index + 1].key] || "")
            return
        }
        await save(nextAnswers)
    }

    function back() {
        if (index === 0) return
        const previous = steps[index - 1]
        setIndex(index - 1)
        setDraft(answers[previous.key] || "")
        setError("")
    }

    async function skip() {
        if (!step.optional) return
        const nextAnswers = applyValue("")
        if (index < steps.length - 1) {
            setIndex(index + 1)
            setDraft(nextAnswers[steps[index + 1].key] || "")
            return
        }
        await save(nextAnswers)
    }

    return (
        <div className="w-page w-create">
            <Link href="/workspace" className="w-back"><ArrowLeft size={16} aria-hidden="true" /> My AIs</Link>
            <h1 className="w-h1">Teach a new AI</h1>
            <p className="w-lede">Answer a few outcome questions. It stays private until you showcase it.</p>
            <div className="w-steps" aria-hidden="true">
                {progress.map((on, i) => <i key={i} className={on ? "on" : ""} />)}
            </div>
            <ol className="w-transcript">
                {steps.slice(0, index).map((item) => (
                    <li key={item.key}>
                        <p className="w-q">{item.prompt}</p>
                        <p className="w-a">{answers[item.key] || "Skipped"}</p>
                    </li>
                ))}
            </ol>
            <form className="w-ask" onSubmit={submit}>
                <label htmlFor="create-answer">{step.prompt}</label>
                <textarea
                    id="create-answer"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={step.placeholder}
                    rows={4}
                    autoFocus
                    onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault()
                            event.currentTarget.form?.requestSubmit()
                        }
                    }}
                />
                {error ? <p className="w-error" role="alert">{error}</p> : null}
                <div className="w-inline-actions">
                    {index > 0 ? (
                        <button className="w-btn secondary" type="button" onClick={back} disabled={busy}>Back</button>
                    ) : null}
                    {step.optional ? (
                        <button className="w-btn secondary" type="button" onClick={() => void skip()} disabled={busy}>Skip</button>
                    ) : null}
                    <button className="w-btn" type="submit" disabled={busy}>
                        {busy ? "Saving…" : index === steps.length - 1 ? "Save as private" : "Continue"}
                        {index === steps.length - 1 ? null : <ArrowRight size={16} aria-hidden="true" />}
                    </button>
                </div>
            </form>
        </div>
    )
}
