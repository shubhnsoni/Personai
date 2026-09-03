"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Download, Plus } from "lucide-react"
import { toast } from "sonner"
import {
    createRestaurantTable,
    rotateRestaurantTableCode,
    setRestaurantAllSeats,
    setRestaurantTableActive,
    setRestaurantTableCount,
    setRestaurantTableReserved,
    setRestaurantTableSeats,
    setRestaurantTableZone,
} from "@/app/actions/tables"
import { drawQrCard } from "@/lib/qr-draw"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const FLOORS = ["Ground", "1st floor", "2nd floor", "Terrace", "Basement"]

type TableRow = {
    id: string
    label: string
    seats: number | null
    zone?: string | null
    code: string
    isActive: boolean
    isReserved: boolean
}

export type FloorBooking = {
    id: string
    name: string
    detail: string
    time: string
}

function Slider({
    label,
    value,
    min,
    max,
    suffix,
    disabled,
    onCommit,
}: {
    label: string
    value: number
    min: number
    max: number
    suffix: string
    disabled?: boolean
    onCommit: (n: number) => void
}) {
    const [live, setLive] = useState(value)
    const liveRef = useRef(live)
    liveRef.current = live
    useEffect(() => { setLive(value) }, [value])
    function commit() {
        if (liveRef.current !== value) onCommit(liveRef.current)
    }
    return (
        <label className="block min-w-0 flex-1">
            <span className="flex justify-between text-[11px] text-muted-foreground">
                <span>{label}</span>
                <span className="tabular-nums text-foreground">{live} {suffix}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                value={live}
                disabled={disabled}
                onChange={(e) => setLive(Number(e.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                className="pl-range mt-1.5 w-full"
            />
        </label>
    )
}

export function TableQrStudio({
    slug,
    origin,
    tables,
    bookings = [],
}: {
    slug: string
    origin: string
    tables: TableRow[]
    bookings?: FloorBooking[]
}) {
    const [label, setLabel] = useState("")
    const [floorFilter, setFloorFilter] = useState<string | "all">("all")
    const [extraFloors, setExtraFloors] = useState<string[]>([])
    const [newFloor, setNewFloor] = useState("")
    const [addingFloor, setAddingFloor] = useState(false)
    const [pending, start] = useTransition()
    const [openMore, setOpenMore] = useState<string | null>(null)
    const base = useMemo(() => origin.replace(/\/$/, ""), [origin])
    const active = tables.filter((table) => table.isActive)
    const reservedCount = active.filter((table) => table.isReserved).length
    const seatTotal = active.reduce((sum, table) => sum + (table.seats || 4), 0)
    const avgSeats = active.length ? Math.round(seatTotal / active.length) : 4
    const floors = useMemo(() => {
        const names = new Set([...FLOORS, ...extraFloors])
        for (const table of tables) if (table.zone) names.add(table.zone)
        return [...names]
    }, [tables, extraFloors])
    const shown = tables.filter((table) => floorFilter === "all" || (table.zone || "Ground") === floorFilter)

    function tableUrl(code: string) {
        return `${base}/${slug}/menu?t=${encodeURIComponent(code)}`
    }

    async function downloadQr(table: TableRow) {
        try {
            const src = await drawQrCard({ url: tableUrl(table.code), name: table.label, style: "ink", size: 1080 })
            const a = document.createElement("a")
            a.href = src
            a.download = `${slug}-${table.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`
            a.click()
            toast.success(`Saved ${table.label} QR`)
        } catch {
            toast.error("Could not draw that QR")
        }
    }

    return (
        <section className="space-y-4">
            {bookings.length ? (
                <div className="flex gap-3 overflow-x-auto pb-1 text-sm">
                    {bookings.map((booking) => (
                        <div key={booking.id} className="shrink-0 rounded-full bg-muted/70 px-3 py-1.5">
                            <span className="font-medium">{booking.name}</span>
                            <span className="text-muted-foreground"> · {booking.detail} · {booking.time}</span>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="flex items-end justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                    <span className="font-medium text-foreground">{active.length}</span> tables
                    <span className="mx-1.5 text-border">·</span>
                    {seatTotal} seats
                    {reservedCount ? <span className="mx-1.5 text-border">·</span> : null}
                    {reservedCount ? `${reservedCount} reserved` : null}
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Slider
                    label="Tables"
                    value={active.length || 1}
                    min={1}
                    max={120}
                    suffix=""
                    disabled={pending}
                    onCommit={(n) => start(async () => {
                        await setRestaurantTableCount(n)
                        toast.success(`${n} tables`)
                    })}
                />
                <Slider
                    label="Seats each"
                    value={avgSeats}
                    min={2}
                    max={12}
                    suffix=""
                    disabled={pending}
                    onCommit={(n) => start(async () => {
                        await setRestaurantAllSeats(n)
                        toast.success(`All tables set to ${n} seats`)
                    })}
                />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {["all", ...floors].map((floor) => (
                    <button
                        key={floor}
                        type="button"
                        onClick={() => setFloorFilter(floor as typeof floorFilter)}
                        className={cn(
                            "h-7 rounded-full px-2.5 text-[12px]",
                            floorFilter === floor ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                        )}
                    >
                        {floor === "all" ? "All" : floor}
                    </button>
                ))}
                {addingFloor ? (
                    <form
                        className="flex gap-1"
                        onSubmit={(e) => {
                            e.preventDefault()
                            const name = newFloor.trim().slice(0, 40)
                            if (!name) return
                            setExtraFloors((cur) => cur.includes(name) ? cur : [...cur, name])
                            setFloorFilter(name)
                            setNewFloor("")
                            setAddingFloor(false)
                            toast.success(`${name} added`)
                        }}
                    >
                        <Input value={newFloor} onChange={(e) => setNewFloor(e.target.value)} placeholder="Level name" autoFocus className="h-7 w-28 text-xs" />
                        <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[12px]">Add</Button>
                    </form>
                ) : (
                    <button type="button" onClick={() => setAddingFloor(true)} className="h-7 rounded-full px-2 text-[12px] text-muted-foreground hover:text-foreground">
                        + Floor
                    </button>
                )}
                <form
                    className="ml-auto flex gap-1.5"
                    onSubmit={(e) => {
                        e.preventDefault()
                        start(async () => {
                            try {
                                await createRestaurantTable(label, undefined, floorFilter === "all" ? "Ground" : floorFilter)
                                setLabel("")
                                toast.success("Table added")
                            } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not add table")
                            }
                        })
                    }}
                >
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New table" className="h-7 w-28 text-xs" />
                    <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" disabled={pending || !label.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </form>
            </div>

            {shown.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No tables on this floor.</p>
            ) : (
                <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60">
                    {shown.map((table) => (
                        <div key={table.id} className={cn("space-y-2 px-3 py-2.5", !table.isActive && "opacity-45")}>
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{table.label}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {table.isReserved ? "Reserved" : table.isActive ? "Open" : "Hidden"}
                                    </p>
                                </div>
                                <select
                                    value={table.zone || "Ground"}
                                    disabled={pending}
                                    className="h-8 w-[7.5rem] shrink-0 rounded-lg border-0 bg-muted/70 px-2 text-[12px] outline-none"
                                    onChange={(e) => start(async () => setRestaurantTableZone(table.id, e.target.value))}
                                >
                                    {floors.map((floor) => (
                                        <option key={floor} value={floor}>{floor}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className={cn(
                                        "h-7 shrink-0 rounded-full px-2.5 text-[11px] font-medium",
                                        table.isReserved ? "bg-amber-400/20 text-amber-800 dark:text-amber-200" : "text-muted-foreground hover:bg-muted",
                                    )}
                                    disabled={pending || !table.isActive}
                                    onClick={() => start(async () => {
                                        await setRestaurantTableReserved(table.id, !table.isReserved)
                                        toast.success(table.isReserved ? `${table.label} is open` : `${table.label} reserved`)
                                    })}
                                >
                                    {table.isReserved ? "Unreserve" : "Reserve"}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                                    onClick={() => downloadQr(table)}
                                    aria-label={`QR for ${table.label}`}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    className="h-7 shrink-0 rounded-full px-2 text-[11px] text-muted-foreground hover:bg-muted"
                                    onClick={() => setOpenMore(openMore === table.id ? null : table.id)}
                                >
                                    More
                                </button>
                            </div>
                            <Slider
                                label="Seats"
                                value={table.seats || 4}
                                min={2}
                                max={12}
                                suffix=""
                                disabled={pending}
                                onCommit={(n) => start(async () => {
                                    await setRestaurantTableSeats(table.id, n)
                                    toast.success(`${table.label}: ${n} seats`)
                                })}
                            />
                            {openMore === table.id ? (
                                <div className="flex justify-end gap-3 text-[12px]">
                                    <button
                                        type="button"
                                        className="text-muted-foreground underline-offset-2 hover:underline"
                                        disabled={pending}
                                        onClick={() => start(async () => setRestaurantTableActive(table.id, !table.isActive))}
                                    >
                                        {table.isActive ? "Hide table" : "Show table"}
                                    </button>
                                    <button
                                        type="button"
                                        className="text-muted-foreground underline-offset-2 hover:underline"
                                        disabled={pending}
                                        onClick={() => start(async () => {
                                            await rotateRestaurantTableCode(table.id)
                                            toast.success("New QR — reprint")
                                        })}
                                    >
                                        Rotate QR
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
            <style>{`
                .pl-range {
                    -webkit-appearance: none;
                    appearance: none;
                    height: 6px;
                    border-radius: 999px;
                    background: color-mix(in oklab, var(--muted) 100%, transparent);
                    outline: none;
                    cursor: pointer;
                }
                .pl-range::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 999px;
                    background: #00D7FF;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
                    cursor: grab;
                }
                .pl-range::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 999px;
                    background: #00D7FF;
                    border: 2px solid #fff;
                    cursor: grab;
                }
                .pl-range:disabled { opacity: .5; cursor: not-allowed; }
            `}</style>
        </section>
    )
}
