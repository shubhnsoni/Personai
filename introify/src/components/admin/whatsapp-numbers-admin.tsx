"use client"

import { useState, useTransition } from "react"
import {
    defaultAdminWhatsappNumber,
    disableAdminWhatsappNumber,
    enableAdminWhatsappNumber,
    seedAdminWhatsappNumber,
    unlinkAdminWhatsappNumber,
    upsertAdminWhatsappNumber,
} from "@/app/actions/whatsapp-admin"
import type { PublicWhatsappNumber } from "@/lib/whatsapp/numbers"
import { Button } from "@/components/ui/button"
import { AdminEmpty, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export function WhatsappNumbersAdmin({
    numbers,
    webhookUrl,
}: {
    numbers: PublicWhatsappNumber[]
    webhookUrl: string
}) {
    const [pending, start] = useTransition()
    const [error, setError] = useState("")
    const [form, setForm] = useState({
        id: "" as string,
        e164: "+917970547297",
        label: "Introify primary",
        accountSid: "",
        authToken: "",
        whatsappFrom: "",
        isDefault: true,
    })

    function edit(row: PublicWhatsappNumber) {
        setForm({
            id: row.id,
            e164: row.e164,
            label: row.label,
            accountSid: "",
            authToken: "",
            whatsappFrom: row.whatsappFrom,
            isDefault: row.isDefault,
        })
        setError("")
    }

    function resetForm() {
        setForm({
            id: "",
            e164: "+917970547297",
            label: "Introify primary",
            accountSid: "",
            authToken: "",
            whatsappFrom: "",
            isDefault: numbers.length === 0,
        })
    }

    return (
        <div className="space-y-5">
            <AdminPanel title="Webhook">
                <p className="text-sm text-muted-foreground">Point the Twilio WhatsApp sandbox / sender webhook to:</p>
                <code className="mt-2 block break-all rounded-md border bg-muted/40 px-3 py-2 text-xs">{webhookUrl}</code>
                <p className="mt-2 text-xs text-muted-foreground">Validates X-Twilio-Signature. Only registered shop owners (Profile.whatsapp) get a reply; everyone else is ignored.</p>
            </AdminPanel>

            <AdminPanel title={form.id ? "Edit number" : "Link Twilio WhatsApp number"}>
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs">
                        E.164
                        <input
                            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={form.e164}
                            onChange={(e) => setForm({ ...form, e164: e.target.value })}
                        />
                    </label>
                    <label className="text-xs">
                        Label
                        <input
                            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                        />
                    </label>
                    <label className="text-xs">
                        Twilio Account SID {form.id ? "(leave blank to keep)" : ""}
                        <input
                            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-mono"
                            value={form.accountSid}
                            onChange={(e) => setForm({ ...form, accountSid: e.target.value })}
                            autoComplete="off"
                        />
                    </label>
                    <label className="text-xs">
                        Auth Token {form.id ? "(leave blank to keep)" : ""}
                        <input
                            type="password"
                            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-mono"
                            value={form.authToken}
                            onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                            autoComplete="off"
                        />
                    </label>
                    <label className="text-xs md:col-span-2">
                        WhatsApp From (optional — defaults to whatsapp:&lt;e164&gt;)
                        <input
                            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-mono"
                            value={form.whatsappFrom}
                            onChange={(e) => setForm({ ...form, whatsappFrom: e.target.value })}
                            placeholder="whatsapp:+917970547297"
                        />
                    </label>
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                        />
                        Default sender
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        disabled={pending}
                        onClick={() =>
                            start(async () => {
                                try {
                                    setError("")
                                    await upsertAdminWhatsappNumber({
                                        id: form.id || undefined,
                                        e164: form.e164,
                                        label: form.label,
                                        accountSid: form.accountSid || undefined,
                                        authToken: form.authToken || undefined,
                                        whatsappFrom: form.whatsappFrom || undefined,
                                        isDefault: form.isDefault,
                                        status: "ACTIVE",
                                    })
                                    resetForm()
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : "Save failed")
                                }
                            })
                        }
                    >
                        {form.id ? "Save changes" : "Link number"}
                    </Button>
                    {form.id ? (
                        <Button variant="outline" disabled={pending} onClick={() => resetForm()}>
                            Cancel edit
                        </Button>
                    ) : null}
                    <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                            start(async () => {
                                await seedAdminWhatsappNumber()
                            })
                        }
                    >
                        Seed +917970547297
                    </Button>
                </div>
                {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
            </AdminPanel>

            <AdminPanel title="Linked numbers">
                {numbers.length === 0 ? (
                    <AdminEmpty>No WhatsApp business numbers yet. Seed or link one above.</AdminEmpty>
                ) : (
                    numbers.map((row) => (
                        <div key={row.id} className="border-b border-border/60 py-3 last:border-0">
                            <AdminRow>
                                <span className="flex-1 truncate text-sm">
                                    {row.label} · {row.e164}
                                    {row.isDefault ? " · default" : ""}
                                    {row.status === "DISABLED" ? " · disabled" : ""}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {row.hasCredentials ? `SID ${row.accountSidMasked}` : "no credentials"}
                                </span>
                            </AdminRow>
                            <p className="mt-1 text-xs text-muted-foreground font-mono">{row.whatsappFrom || "—"} · token {row.authTokenMasked || "—"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" disabled={pending} onClick={() => edit(row)}>
                                    Edit
                                </Button>
                                {!row.isDefault && row.status === "ACTIVE" ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={pending}
                                        onClick={() => start(() => defaultAdminWhatsappNumber(row.id))}
                                    >
                                        Set default
                                    </Button>
                                ) : null}
                                {row.status === "ACTIVE" ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={pending}
                                        onClick={() => start(() => disableAdminWhatsappNumber(row.id))}
                                    >
                                        Disable
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={pending}
                                        onClick={() => start(() => enableAdminWhatsappNumber(row.id))}
                                    >
                                        Re-enable
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={pending}
                                    onClick={() => start(() => unlinkAdminWhatsappNumber(row.id))}
                                >
                                    Unlink credentials
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </AdminPanel>
        </div>
    )
}
