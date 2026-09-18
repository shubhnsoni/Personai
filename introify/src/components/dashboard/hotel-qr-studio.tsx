"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { generateHotelQrs } from "@/app/actions/hotels"
import { drawQrCard } from "@/lib/qr-draw"
import { hotelQrPath } from "@/lib/hotels"
import { Button } from "@/components/ui/button"

type QrRow = { id: string; code: string; kind: string; label: string | null; scanCount: number; room: { number: string } | null }

export function HotelQrStudio({
    slug,
    origin,
    qrs,
}: {
    slug: string
    origin: string
    qrs: QrRow[]
}) {
    const [pending, start] = useTransition()
    const [printing, setPrinting] = useState(false)
    const base = useMemo(() => origin.replace(/\/$/, ""), [origin])

    function dest(row: QrRow) {
        return `${base}${hotelQrPath(row.code)}`
    }

    async function download(row: QrRow) {
        try {
            const canvas = await drawQrCard({ url: dest(row), name: row.label || row.kind, style: "soft-studio", size: 1080 })
            const a = document.createElement("a")
            a.href = canvas.toDataURL("image/png")
            a.download = `${slug}-${(row.label || row.code).replace(/\s+/g, "-").toLowerCase()}-qr.png`
            a.click()
            toast.success("Saved PNG")
        } catch {
            toast.error("Could not draw that QR")
        }
    }

    async function downloadKit() {
        setPrinting(true)
        try {
            const res = await fetch("/api/hotel/print-kit", { credentials: "include" })
            if (!res.ok) {
                const body = await res.json().catch(() => null) as { error?: string } | null
                throw new Error(body?.error || "Print kit is not ready")
            }
            const blob = await res.blob()
            const a = document.createElement("a")
            a.href = URL.createObjectURL(blob)
            a.download = `${slug}-print-kit.zip`
            a.click()
            URL.revokeObjectURL(a.href)
            toast.success("Saved print package")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not build the print kit")
        } finally {
            setPrinting(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => {
                        await generateHotelQrs()
                        toast.success("Property and room QRs are ready")
                    })}
                    className="h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 active:scale-[0.96]"
                >
                    Generate QRs
                </Button>
                <Button
                    type="button"
                    disabled={printing || qrs.length === 0}
                    variant="outline"
                    onClick={() => void downloadKit()}
                    className="h-11 min-h-11 rounded-2xl border-white/10 transition-transform duration-150 active:scale-[0.96]"
                >
                    Download print package
                </Button>
            </div>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8 studio-panel">
                {qrs.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Generate a property QR plus one per room, then download the print package. Test each QR before print.</p>
                ) : qrs.map((row) => (
                    <div key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium">{row.label || row.kind}</p>
                            <p className="truncate text-xs text-muted-foreground">{dest(row)} · {row.scanCount} scans</p>
                        </div>
                        <a
                            href={dest(row)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-3 text-xs transition-transform duration-150 active:scale-[0.96]"
                        >
                            Test QR
                        </a>
                        <button
                            type="button"
                            onClick={() => void download(row)}
                            className="min-h-11 rounded-full border border-white/10 px-3 text-xs transition-transform duration-150 active:scale-[0.96]"
                        >
                            PNG
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
