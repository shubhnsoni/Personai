"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveHotelSetup } from "@/app/actions/hotels"
import { HOTEL_SERVICE_OPTIONS } from "@/lib/hotels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function HotelSetupForm({
    initial,
}: {
    initial: {
        address: string
        receptionPhone: string
        receptionWhatsapp: string
        checkInTime: string
        checkOutTime: string
        wifiName: string
        wifiPassword: string
        emergencyContact: string
        policiesSummary: string
        services: string[]
        amenities: string[]
        quietHours: string
        parkingInfo: string
        propertyHours: string
    }
}) {
    const [pending, start] = useTransition()
    const [form, setForm] = useState(initial)
    const [amenityDraft, setAmenityDraft] = useState("")

    function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm((cur) => ({ ...cur, [key]: value }))
    }

    function toggleService(id: string) {
        setForm((cur) => ({
            ...cur,
            services: cur.services.includes(id) ? cur.services.filter((item) => item !== id) : [...cur.services, id],
        }))
    }

    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault()
                start(async () => {
                    try {
                        await saveHotelSetup({
                            ...form,
                            amenities: form.amenities,
                        })
                        toast.success("Property saved")
                    } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not save")
                    }
                })
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Check-in</span>
                    <Input value={form.checkInTime} onChange={(e) => set("checkInTime", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Checkout</span>
                    <Input value={form.checkOutTime} onChange={(e) => set("checkOutTime", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Wi-Fi name</span>
                    <Input value={form.wifiName} onChange={(e) => set("wifiName", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Wi-Fi password</span>
                    <Input value={form.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm sm:col-span-2">
                    <span className="text-muted-foreground">Address</span>
                    <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Reception WhatsApp</span>
                    <Input value={form.receptionWhatsapp} onChange={(e) => set("receptionWhatsapp", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Emergency contact</span>
                    <Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Property hours</span>
                    <Input value={form.propertyHours} onChange={(e) => set("propertyHours", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Quiet hours</span>
                    <Input value={form.quietHours} onChange={(e) => set("quietHours", e.target.value)} className="h-11 rounded-2xl" />
                </label>
                <label className="space-y-1.5 text-sm sm:col-span-2">
                    <span className="text-muted-foreground">Parking</span>
                    <Input value={form.parkingInfo} onChange={(e) => set("parkingInfo", e.target.value)} className="h-11 rounded-2xl" />
                </label>
            </div>
            <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Guest services</p>
                <div className="flex flex-wrap gap-2">
                    {HOTEL_SERVICE_OPTIONS.map((option) => {
                        const on = form.services.includes(option.id)
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => toggleService(option.id)}
                                className={cn(
                                    "min-h-11 rounded-full border px-3.5 text-sm font-medium transition-transform duration-150 active:scale-[0.96]",
                                    on ? "border-cyan-400/60 bg-cyan-400/10 text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground",
                                )}
                            >
                                {option.label}
                            </button>
                        )
                    })}
                </div>
            </div>
            <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Policies (guest-visible)</span>
                <textarea
                    value={form.policiesSummary}
                    onChange={(e) => set("policiesSummary", e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-3 py-2.5 text-sm"
                />
            </label>
            <div className="flex flex-wrap gap-2">
                {form.amenities.map((item) => (
                    <button
                        key={item}
                        type="button"
                        className="min-h-9 rounded-full bg-white/6 px-3 text-xs"
                        onClick={() => set("amenities", form.amenities.filter((row) => row !== item))}
                    >
                        {item} ×
                    </button>
                ))}
                <Input
                    value={amenityDraft}
                    onChange={(e) => setAmenityDraft(e.target.value)}
                    placeholder="Add amenity"
                    className="h-11 max-w-xs rounded-2xl"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            const next = amenityDraft.trim()
                            if (!next) return
                            set("amenities", [...form.amenities, next])
                            setAmenityDraft("")
                        }
                    }}
                />
            </div>
            <Button type="submit" disabled={pending} className="h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 active:scale-[0.96] hover:bg-[#5ee7ff]">
                Save property
            </Button>
        </form>
    )
}
