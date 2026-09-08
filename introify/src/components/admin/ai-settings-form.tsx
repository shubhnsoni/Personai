"use client"

import { useState, useTransition } from "react"
import { saveAdminAiSettings, testAdminAiPing } from "@/app/actions/admin"
import type { PlatformAiSettings } from "@/lib/admin/ai-settings"
import { Button } from "@/components/ui/button"

export function AiSettingsForm({
    settings,
    status,
}: {
    settings: PlatformAiSettings
    status: Record<"codex" | "xai" | "openai", boolean>
}) {
    const [draft, setDraft] = useState(settings)
    const [pending, start] = useTransition()
    const [ping, setPing] = useState<string>("")

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
                {(["codex", "xai", "openai"] as const).map((kind) => (
                    <label key={kind} className="rounded-xl border p-4 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">{kind === "xai" ? "SpaceXAI" : kind === "codex" ? "Codex" : "OpenAI"}</span>
                            <span className="text-xs text-muted-foreground">{status[kind] ? "keys ok" : "not configured"}</span>
                        </div>
                        <label className="mt-3 flex items-center justify-between text-xs">
                            Kill
                            <input
                                type="checkbox"
                                checked={draft.kill[kind]}
                                onChange={(e) => setDraft({ ...draft, kill: { ...draft.kill, [kind]: e.target.checked } })}
                            />
                        </label>
                        <input
                            className="mt-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
                            value={draft.models[kind]}
                            onChange={(e) => setDraft({ ...draft, models: { ...draft.models, [kind]: e.target.value } })}
                        />
                    </label>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                    Default
                    <select
                        className="ml-2 h-9 rounded-md border bg-background px-2"
                        value={draft.defaultProvider}
                        onChange={(e) => setDraft({ ...draft, defaultProvider: e.target.value as PlatformAiSettings["defaultProvider"] })}
                    >
                        <option value="codex">Codex</option>
                        <option value="xai">SpaceXAI</option>
                        <option value="openai">OpenAI</option>
                    </select>
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Fallbacks</span>
                    {draft.fallback.map((kind, index) => (
                        <span key={`${kind}-${index}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                            {kind}
                            <button
                                type="button"
                                className="text-muted-foreground"
                                onClick={() => {
                                    if (index === 0) return
                                    const next = [...draft.fallback]
                                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                                    setDraft({ ...draft, fallback: next })
                                }}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className="text-muted-foreground"
                                onClick={() => {
                                    if (index >= draft.fallback.length - 1) return
                                    const next = [...draft.fallback]
                                    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                                    setDraft({ ...draft, fallback: next })
                                }}
                            >
                                ↓
                            </button>
                        </span>
                    ))}
                </div>
                <Button disabled={pending} onClick={() => start(() => saveAdminAiSettings(draft))}>Save</Button>
                <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => start(async () => {
                        const result = await testAdminAiPing(draft.defaultProvider)
                        setPing(result.ok ? `${result.provider} ${result.ms}ms · ${result.preview}` : `${result.provider} fail · ${result.error}`)
                    })}
                >
                    Test chat
                </Button>
                {ping ? <span className="text-xs text-muted-foreground">{ping}</span> : null}
            </div>
        </div>
    )
}
