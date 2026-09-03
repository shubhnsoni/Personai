"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { galleryToJson, parseGallery } from "@/lib/commerce"
import { PhotoStage } from "@/components/shop/photo-stage"
import type { DigitalProduct } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FileField } from "@/components/ui/file-field"
import { createProduct, updateProduct } from "@/app/actions/products"
import { cn } from "@/lib/utils"
import { ArStudio, ArTrigger } from "@/components/shop/ar-studio"
import { defaultFulfillment, fieldOn } from "@/lib/surfaces"
import type { GoldBoard } from "@/lib/metal/board"
import { bpsToKarat, gramsToMg, isJewelryRetail, karatToBps, mgToGrams, rupeesToPaise, ticketPaise, type Karat } from "@/lib/metal/math"
import { parseProductMetal } from "@/lib/metal/product"

type Kind = "PHYSICAL" | "DIGITAL" | "BOTH"

function variantsFrom(product?: DigitalProduct | null) {
    try {
        const parsed = product?.variantsJson ? JSON.parse(product.variantsJson) : []
        return Array.isArray(parsed) ? parsed.map((v: { name?: string }) => v.name || "").filter(Boolean).join("\n") : ""
    } catch {
        return product?.variantsJson || ""
    }
}

export function QuickAddSheet({
    open,
    onOpenChange,
    profileId,
    product,
    restaurant,
    role,
    jewelry,
    goldBoard,
    onPhotoreal,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    profileId: string
    product?: DigitalProduct | null
    restaurant?: boolean
    role?: string | null
    jewelry?: boolean
    goldBoard?: GoldBoard | null
    onPhotoreal?: () => void
}) {
    const pack = (p: Parameters<typeof fieldOn>[1]) => fieldOn(role, p)
    const showPhysical = pack("shopPhysical")
    const showDigital = pack("shopDigital")
    const showMenu = pack("menuDish")
    const showAr = pack("ar")
    const showKindToggle = showPhysical && showDigital && !restaurant
    const router = useRouter()
    const editing = !!product
    const [more, setMore] = useState(false)
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [stock, setStock] = useState("")
    const [fulfillment, setFulfillment] = useState<Kind>("PHYSICAL")
    const [photos, setPhotos] = useState<string[]>([])
    const [photoIndex, setPhotoIndex] = useState(0)
    const [live, setLive] = useState(true)
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [sku, setSku] = useState("")
    const [variantsText, setVariantsText] = useState("")
    const [allowCod, setAllowCod] = useState(false)
    const [shipMode, setShipMode] = useState<"NONE" | "PICKUP" | "DELIVER" | "BOTH">("NONE")
    const [shipFee, setShipFee] = useState("")
    const [fileUrl, setFileUrl] = useState("")
    const [compareAt, setCompareAt] = useState("")
    const [diet, setDiet] = useState("")
    const [spiceLevel, setSpiceLevel] = useState("")
    const [serveWindow, setServeWindow] = useState("ALL")
    const [prepMinutes, setPrepMinutes] = useState("15")
    const [arModelUrl, setArModelUrl] = useState("")
    const [arUsdzUrl, setArUsdzUrl] = useState("")
    const [arOpen, setArOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)
    const gold = jewelry || isJewelryRetail(role)
    const [grams, setGrams] = useState("")
    const [karat, setKarat] = useState<Karat>("22K")
    const [making, setMaking] = useState("")

    useEffect(() => {
        if (!open) return
        setMore(editing)
        setTitle(product?.title || "")
        setPrice(product ? String(product.priceCents / 100) : "")
        setStock(product?.stock != null ? String(product.stock) : "")
        setFulfillment((product?.fulfillment as Kind) || (product?.type === "PHYSICAL" ? "PHYSICAL" : product ? "DIGITAL" : defaultFulfillment(role)))
        const next = parseGallery(product?.galleryUrls, product?.thumbnailUrl)
        setPhotos(next)
        setPhotoIndex(0)
        setLive(product?.isActive ?? true)
        setDescription(product?.description || "")
        setCategory(product?.category || "")
        setSku(product?.sku || "")
        setVariantsText(variantsFrom(product))
        setAllowCod(product?.allowCod ?? false)
        setShipMode((product?.shipMode as typeof shipMode) || "NONE")
        setShipFee(product?.shipFeeCents ? String(product.shipFeeCents / 100) : "")
        setFileUrl(product?.fileUrl || "")
        setCompareAt(product?.compareAtCents ? String(product.compareAtCents / 100) : "")
        setDiet((product as { diet?: string | null })?.diet || "")
        setSpiceLevel((product as { spiceLevel?: number | null })?.spiceLevel != null ? String((product as { spiceLevel?: number | null }).spiceLevel) : "")
        setServeWindow((product as { serveWindow?: string | null })?.serveWindow || "ALL")
        setPrepMinutes(String((product as { prepMinutes?: number | null })?.prepMinutes || 15))
        setArModelUrl((product as { arModelUrl?: string | null })?.arModelUrl || "")
        setArUsdzUrl((product as { arUsdzUrl?: string | null })?.arUsdzUrl || "")
        const metal = parseProductMetal(product?.variantsJson)
        setGrams(metal ? String(mgToGrams(metal.grossMg)) : "")
        setKarat(metal ? bpsToKarat(metal.purityBps) || "22K" : "22K")
        setMaking(metal ? String(metal.makingPaise / 100) : "")
    }, [open, product, editing])

    function reset() {
        setMore(false)
        setTitle("")
        setPrice("")
        setStock("")
        setFulfillment(defaultFulfillment(role))
        setPhotos([])
        setPhotoIndex(0)
        setLive(true)
        setDescription("")
        setCategory("")
        setSku("")
        setVariantsText("")
        setAllowCod(false)
        setShipMode("NONE")
        setShipFee("")
        setFileUrl("")
        setCompareAt("")
        setDiet("")
        setSpiceLevel("")
        setServeWindow("ALL")
        setPrepMinutes("15")
        setArModelUrl("")
        setArUsdzUrl("")
        setArOpen(false)
        setGrams("")
        setKarat("22K")
        setMaking("")
    }

    return (
        <>
        <Sheet
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next)
                if (!next) reset()
            }}
        >
            <SheetContent
                side="bottom"
                className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-border/70 p-0"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={async (e) => {
                        e.preventDefault()
                        if (!title.trim()) return
                        setBusy(true)
                        try {
                            const metal = gold && Number(grams) > 0
                                ? {
                                    grossMg: gramsToMg(Number(grams)),
                                    purityBps: karatToBps(karat),
                                    makingPaise: rupeesToPaise(Number(making) || 0),
                                }
                                : undefined
                            const ticket = metal && goldBoard ? ticketPaise(metal, goldBoard) / 100 : parseFloat(price) || 0
                            const payload = {
                                title: title.trim(),
                                price: ticket,
                                currency: gold ? "INR" as const : undefined,
                                metal: metal ?? undefined,
                                existingVariantsJson: product?.variantsJson,
                                type: (fulfillment === "PHYSICAL" ? "PHYSICAL" : "OTHER") as "PHYSICAL" | "OTHER",
                                fulfillment,
                                stock: stock === "" ? null : parseInt(stock, 10),
                                thumbnailUrl: (photos[photoIndex] || photos[0]) || undefined,
                                galleryUrls: galleryToJson(
                                    photos[photoIndex]
                                        ? [photos[photoIndex], ...photos.filter((_, i) => i !== photoIndex)]
                                        : photos,
                                ) || undefined,
                                isActive: live,
                                description: description.trim() || undefined,
                                category: category.trim() || undefined,
                                sku: sku.trim() || undefined,
                                variantsText: more ? variantsText : undefined,
                                allowCod,
                                shipMode,
                                shipFeeCents: shipFee ? Math.round(parseFloat(shipFee) * 100) : 0,
                                fileUrl: fileUrl.trim() || undefined,
                                compareAtCents: compareAt ? Math.round(parseFloat(compareAt) * 100) : undefined,
                                diet: diet || undefined,
                                spiceLevel: spiceLevel === "" ? null : parseInt(spiceLevel, 10),
                                serveWindow: serveWindow || undefined,
                                prepMinutes: restaurant ? parseInt(prepMinutes, 10) || 15 : undefined,
                                arModelUrl: arModelUrl || undefined,
                                arUsdzUrl: arUsdzUrl || undefined,
                            }
                            if (product) await updateProduct(product.id, payload)
                            else await createProduct(profileId, payload)
                            toast.success(product ? "Saved" : restaurant ? "Live on the menu" : "Live in the shop")
                            reset()
                            onOpenChange(false)
                            router.refresh()
                        } catch {
                            toast.error("Could not save")
                        } finally {
                            setBusy(false)
                        }
                    }}
                >
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-3">
                        <SheetHeader className="space-y-1 p-0 text-left">
                            <SheetTitle className="text-lg">{editing ? "Edit item" : restaurant ? "Add to menu" : gold ? "Add a piece" : "Add to shop"}</SheetTitle>
                            <SheetDescription>
                                {gold
                                    ? "Weight, purity, making. Price follows today’s city board."
                                    : more ? "Extra detail. You can still save with just name and price." : "Photo, name, price. Tap More if you need it."}
                            </SheetDescription>
                        </SheetHeader>

                        {showKindToggle ? (
                        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/70 p-1">
                            {(["PHYSICAL", "DIGITAL", "BOTH"] as const).map((kind) => (
                                <button
                                    key={kind}
                                    type="button"
                                    onClick={() => setFulfillment(kind)}
                                    className={cn(
                                        "h-9 rounded-xl text-[13px] font-medium",
                                        fulfillment === kind ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                                    )}
                                >
                                    {kind === "PHYSICAL" ? "Physical" : kind === "DIGITAL" ? "Digital" : "Both"}
                                </button>
                            ))}
                        </div>
                        ) : null}

                        <PhotoStage
                            photos={photos}
                            active={Math.min(photoIndex, Math.max(0, photos.length - 1))}
                            onSelect={setPhotoIndex}
                            onRemove={(i) => {
                                setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                                setPhotoIndex((cur) => (cur > i ? cur - 1 : Math.max(0, Math.min(cur, photos.length - 2))))
                            }}
                            uploading={uploading}
                            emptyLabel="Tap for photos"
                            onAdd={async (files) => {
                                setUploading(true)
                                try {
                                    const urls: string[] = []
                                    for (const file of files) {
                                        const body = new FormData()
                                        body.append("file", file)
                                        const res = await fetch("/api/upload", { method: "POST", body })
                                        const json = await res.json()
                                        if (json.url) urls.push(json.url)
                                    }
                                    if (!urls.length) {
                                        toast.error("Upload failed")
                                        return
                                    }
                                    setPhotos((prev) => {
                                        const next = [...prev, ...urls]
                                        if (prev.length === 0) setPhotoIndex(0)
                                        return next
                                    })
                                } finally {
                                    setUploading(false)
                                }
                            }}
                        />

                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Name"
                            autoFocus
                            className="h-12 rounded-2xl border-border/70 text-base"
                        />
                        {gold ? (
                        <div className="grid grid-cols-3 gap-2.5">
                            <Input
                                inputMode="decimal"
                                value={grams}
                                onChange={(e) => setGrams(e.target.value)}
                                placeholder="Grams"
                                className="h-12 rounded-2xl border-border/70 text-base"
                            />
                            <select
                                value={karat}
                                onChange={(e) => setKarat(e.target.value as Karat)}
                                className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-base"
                            >
                                <option value="22K">22K</option>
                                <option value="24K">24K</option>
                                <option value="18K">18K</option>
                            </select>
                            <Input
                                inputMode="decimal"
                                value={making}
                                onChange={(e) => setMaking(e.target.value)}
                                placeholder="Making ₹"
                                className="h-12 rounded-2xl border-border/70 text-base"
                            />
                        </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2.5">
                            {gold ? null : (
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="Price"
                                className="h-12 rounded-2xl border-border/70 text-base"
                            />
                            )}
                            {showPhysical || showMenu ? (
                            <Input
                                type="number"
                                min="0"
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                placeholder={fulfillment === "DIGITAL" ? "Stock (opt.)" : "Stock"}
                                className="h-12 rounded-2xl border-border/70 text-base"
                            />
                            ) : (
                            <div />
                            )}
                        </div>
                        <label className="flex h-12 items-center justify-between rounded-2xl bg-muted/50 px-3.5 text-sm">
                            Live now
                            <Switch checked={live} onCheckedChange={setLive} />
                        </label>
                        {restaurant ? (
                            <label className="block rounded-2xl bg-muted/50 px-3.5 py-3">
                                <span className="flex justify-between text-[12px] text-muted-foreground">
                                    <span>Cooking time</span>
                                    <span className="tabular-nums font-medium text-foreground">{prepMinutes} min</span>
                                </span>
                                <input
                                    type="range"
                                    min={5}
                                    max={90}
                                    step={5}
                                    value={Number(prepMinutes) || 15}
                                    onChange={(e) => setPrepMinutes(e.target.value)}
                                    className="mt-2 w-full accent-cyan-500"
                                />
                            </label>
                        ) : null}
                        {showAr ? (
                            <ArTrigger hasModel={Boolean(arModelUrl)} restaurant={restaurant} onClick={() => setArOpen(true)} />
                        ) : null}

                        <button
                            type="button"
                            onClick={() => setMore((v) => !v)}
                            className="flex w-full items-center justify-between rounded-2xl px-1 py-1 text-sm font-medium"
                        >
                            More
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", more && "rotate-180")} />
                        </button>

                        {more ? (
                            <div className="space-y-3 pb-2">
                                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={showMenu ? "Category — Starters, Mains, Snacks" : "Category"} className="h-11 rounded-2xl" />
                                {showMenu ? (
                                    <>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {([
                                                ["", "Diet"],
                                                ["VEG", "Veg"],
                                                ["NONVEG", "Non-veg"],
                                                ["VEGAN", "Vegan"],
                                            ] as const).map(([id, label]) => (
                                                <button
                                                    key={id || "none"}
                                                    type="button"
                                                    onClick={() => setDiet(id)}
                                                    className={cn(
                                                        "h-9 rounded-xl text-[11px]",
                                                        diet === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {["ALL", "BREAKFAST", "LUNCH", "DINNER"].map((id) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setServeWindow(id)}
                                                    className={cn(
                                                        "h-9 rounded-xl text-[11px]",
                                                        serveWindow === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {id === "ALL" ? "All day" : id[0] + id.slice(1).toLowerCase()}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {["", "1", "2", "3"].map((n) => (
                                                <button
                                                    key={n || "0"}
                                                    type="button"
                                                    onClick={() => setSpiceLevel(n)}
                                                    className={cn(
                                                        "h-9 rounded-xl text-[11px]",
                                                        spiceLevel === n ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {n === "" ? "No spice" : "🌶".repeat(Number(n))}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                                {showPhysical ? <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU (optional)" className="h-11 rounded-2xl" /> : null}
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short pitch" rows={3} className="rounded-2xl" />
                                {showPhysical && fulfillment !== "DIGITAL" ? (
                                    <>
                                        <Textarea value={variantsText} onChange={(e) => setVariantsText(e.target.value)} placeholder={"Variants, one per line\nS\nM\nL"} rows={3} className="rounded-2xl" />
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {([
                                                ["NONE", "Ask me"],
                                                ["PICKUP", "Pickup"],
                                                ["DELIVER", "Deliver"],
                                                ["BOTH", "Either"],
                                            ] as const).map(([id, label]) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setShipMode(id)}
                                                    className={cn(
                                                        "h-9 rounded-xl text-[12px]",
                                                        shipMode === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {shipMode === "DELIVER" || shipMode === "BOTH" ? (
                                            <Input type="number" min="0" step="0.01" value={shipFee} onChange={(e) => setShipFee(e.target.value)} placeholder="Delivery fee" className="h-11 rounded-2xl" />
                                        ) : null}
                                        <label className="flex h-12 items-center justify-between rounded-2xl border px-3.5 text-sm">
                                            Cash on delivery
                                            <Switch checked={allowCod} onCheckedChange={setAllowCod} />
                                        </label>
                                    </>
                                ) : null}
                                {showDigital && fulfillment !== "PHYSICAL" ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Digital file</Label>
                                        <FileField
                                            accept="*/*"
                                            buttonLabel="Choose file"
                                            emptyLabel={fileUrl ? "File attached" : "PDF, zip, video…"}
                                            onFile={async (file) => {
                                                if (!file) return
                                                setUploading(true)
                                                try {
                                                    const body = new FormData()
                                                    body.append("file", file)
                                                    const res = await fetch("/api/upload", { method: "POST", body })
                                                    const json = await res.json()
                                                    if (json.url) setFileUrl(json.url)
                                                    else toast.error("Upload failed")
                                                } finally {
                                                    setUploading(false)
                                                }
                                            }}
                                        />
                                        <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="or paste a file URL" className="h-11 rounded-2xl" />
                                    </div>
                                ) : null}
                                <Input type="number" min="0" step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Compare-at price (optional)" className="h-11 rounded-2xl" />
                            </div>
                        ) : null}
                    </div>

                    <div className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="h-11 flex-[1.4] rounded-full" disabled={busy || !title.trim()}>
                                {busy ? "Saving..." : editing ? "Save" : restaurant ? "Add to menu" : "Add to shop"}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
        <ArStudio
            open={arOpen}
            onOpenChange={setArOpen}
            existing={arModelUrl || null}
            sourcePhotos={photos}
            restaurant={restaurant}
            onPhotoreal={onPhotoreal}
            onPhoto={(url) => {
                setPhotos((prev) => (prev.includes(url) ? prev : [...prev, url]))
            }}
            onReady={(glb, usdz) => {
                setArModelUrl(glb)
                if (usdz) setArUsdzUrl(usdz)
            }}
        />
        </>
    )
}
