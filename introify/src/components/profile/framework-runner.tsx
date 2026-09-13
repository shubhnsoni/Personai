"use client"

import { useState } from "react"
import { evaluateFramework, type FrameworkAnswer } from "@/lib/profile-expertise-policy"
import type { FrameworkDraft } from "@/lib/profile-import-contract"
import { cn } from "@/lib/utils"

const OPTIONS: Array<{ id: FrameworkAnswer; label: string }> = [
    { id: "yes", label: "Yes" },
    { id: "partly", label: "Partly" },
    { id: "no", label: "No" },
    { id: "unsure", label: "Unsure" },
]

export function FrameworkRunner({ title, description, definition }: { title: string; description: string; definition: FrameworkDraft }) {
    const [answers, setAnswers] = useState<Record<string, FrameworkAnswer>>({})
    const result = evaluateFramework(definition, answers)
    const answered = Object.keys(answers).length

    return (
        <section className="space-y-4">
            <header className="space-y-1">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="text-xs text-muted-foreground">
                    Self-assessment, not a validated professional diagnosis. Equal weight: Yes 2, Partly 1, No 0. Unsure means no overall score yet.
                </p>
            </header>
            <div className="space-y-4">
                {definition.questions.map((question, index) => (
                    <fieldset key={question.id} className="space-y-2 rounded-2xl border border-border/70 p-3">
                        <legend className="px-1 text-sm font-medium">{index + 1}. {question.label}</legend>
                        {question.guidance ? <p className="text-xs text-muted-foreground">{question.guidance}</p> : null}
                        <div role="radiogroup" aria-label={question.label} className="flex flex-wrap gap-1.5">
                            {OPTIONS.map(option => (
                                <label key={option.id} className={cn(
                                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium",
                                    answers[question.id] === option.id ? "border-foreground bg-foreground text-background" : "border-border/70",
                                )}>
                                    <input
                                        type="radio"
                                        name={`q-${question.id}`}
                                        className="sr-only"
                                        checked={answers[question.id] === option.id}
                                        onChange={() => setAnswers(current => ({ ...current, [question.id]: option.id }))}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ))}
            </div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm">
                    {result.score === null
                        ? (answered ? "No overall score yet — some answers are Unsure or still open." : "Answer the questions to see a local score.")
                        : `Local score: ${result.score} / 100`}
                    {result.reviewIds.length ? <span className="text-muted-foreground"> · {result.reviewIds.length} to review</span> : null}
                </p>
                <button type="button" onClick={() => setAnswers({})} className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium">
                    Reset
                </button>
            </div>
        </section>
    )
}
