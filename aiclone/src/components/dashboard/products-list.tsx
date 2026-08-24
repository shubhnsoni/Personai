"use client"

import { useMemo, useState, useTransition } from "react"
import { DigitalProduct } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import {
    Plus,
    Trash2,
    FileText,
    Video,
    Music,
    Package,
    Copy,
    Upload,
    ExternalLink,
    Gift,
} from "lucide-react"
import { deleteProduct, setProductActive } from "@/app/actions/products"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { CatalogSearch, FilterChips, ViewToggle, useCatalogView } from "@/components/dashboard/catalog-chrome"
import { QuickAddSheet } from "@/components/dashboard/quick-add-sheet"
import { ImportStudio, type ImportApplyCtl } from "@/components/dashboard/import-studio"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useMoney } from "@/components/pricing-provider"
import { isPhysical, parseGallery, stockLabel, whatsappHref } from "@/lib/commerce"
import { fieldOn, type SurfaceExtras } from "@/lib/surfaces"

interface ProductsListProps {
    profileId: string
    slug: string
    whatsapp?: string | null
    restaurant?: boolean
    role?: string | null
    extras?: SurfaceExtras | null
    products: DigitalProduct[]
}

const typeIcon: Record<string, typeof FileText> = {
    PDF: FileText,
    VIDEO: Video,
    AUDIO: Music,
    OTHER: Package,
    PHYSICAL: Package,
}

export function ProductsList({ slug, profileId, whatsapp, restaurant, role, extras, products }: ProductsListProps) {
    const [view, setViewPersist] = useCatalogView("pl-shop-view")
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "on" | "off" | "free" | "low">("all")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<DigitalProduct | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [importCtl, setImportCtl] = useState<ImportApplyCtl>(null)

    const sold = products.reduce((s, p) => s + (p.downloadCount || 0), 0)
    const live = products.filter((p) => p.isActive).length

    const rows = useMemo(() => {
        return products.filter((p) => {
            if (filter === "on" && !p.isActive) return false
            if (filter === "off" && p.isActive) return false
            if (filter === "free" && p.priceCents > 0) return false
            if (filter === "low" && !(p.stock != null && p.stock <= 3)) return false
            if (!q.trim()) return true
            const hay = `${p.title} ${p.subtitle || ""} ${p.type} ${p.category || ""}`.toLowerCase()
            return hay.includes(q.trim().toLowerCase())
        })
    }, [products, filter, q])

    const remove = async (id: string) => {
        if (!confirm("Delete this product?")) return
        setDeletingId(id)
        try {
            await deleteProduct(id)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-3">
            {restaurant ? (
                <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 text-left"
                >
                    <span>
                        <span className="block text-sm font-medium">Import menu</span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">Swiggy, Zomato, or Uber Eats — paste the public link</span>
                    </span>
                    <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
            ) : null}

            <div className="flex items-center gap-2">
                <CatalogSearch value={q} onChange={setQ} />
                <ViewToggle view={view} onChange={setViewPersist} />
            </div>

            <FilterChips
                value={filter}
                onChange={setFilter}
                count={`${live} on · ${sold} sold`}
                items={[
                    { id: "all", label: "All" },
                    { id: "on", label: "On" },
                    { id: "off", label: "Off" },
                    { id: "free", label: "Free" },
                    { id: "low", label: "Low stock" },
                ]}
            />

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Package />}
                        title={products.length === 0 ? (restaurant ? "Nothing on the menu" : "Nothing in the shop") : "Nothing matches"}
                        description={
                            products.length === 0
                                ? restaurant
                                    ? "Import from Swiggy, Zomato, or Uber Eats — or add a dish."
                                    : "Photo, name, price. Live in one tap."
                                : "Try another search or filter."
                        }
                    />
                </div>
            ) : view === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((product) => (
                        <ProductRow
                            key={product.id}
                            product={product}
                            deleting={deletingId === product.id}
                            pending={pending}
                            onOpen={() => setEditing(product)}
                            onToggle={(on) => startTransition(async () => { await setProductActive(product.id, on) })}
                            onDelete={() => remove(product.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {rows.map((product) => (
                        <ProductTile
                            key={product.id}
                            product={product}
                            deleting={deletingId === product.id}
                            pending={pending}
                            onOpen={() => setEditing(product)}
                            onToggle={(on) => startTransition(async () => { await setProductActive(product.id, on) })}
                            onDelete={() => remove(product.id)}
                        />
                    ))}
                </div>
            )}

            <StudioDock>
                <DockTabs
                    tabs={[
                        {
                            id: "copy",
                            label: "Copy",
                            icon: <Copy />,
                            onClick: async () => {
                                const url = `${window.location.origin}/${slug}/${restaurant ? "menu" : "shop"}`
                                try {
                                    await navigator.clipboard.writeText(url)
                                    toast.success(restaurant ? "Menu link copied" : "Shop link copied")
                                } catch {
                                    toast.error(url)
                                }
                            },
                        },
                        { id: "import", label: "Import", icon: <Upload />, onClick: () => setImportOpen(true) },
                        ...(fieldOn(role, "shopDigital")
                            ? [{ id: "downloads", label: "Downloads", icon: <Gift />, href: "/dashboard/lead-magnets" }]
                            : []),
                        { id: "live", label: "Live", icon: <ExternalLink />, href: `/${slug}/${restaurant ? "menu" : "shop"}`, target: "_blank" },
                        {
                            id: "wa",
                            label: "Share",
                            icon: <Copy />,
                            onClick: () => {
                                const url = `${window.location.origin}/${slug}/${restaurant ? "menu" : "shop"}`
                                const liveItems = products.filter((p) => p.isActive).slice(0, 12)
                                const list = liveItems
                                    .map((p) => `• ${p.title} — ${(p.priceCents / 100).toFixed(0)}${p.stock != null && p.stock <= 3 ? p.stock <= 0 ? " (sold out)" : ` (${p.stock} left)` : ""}`)
                                    .join("\n")
                                const text = `${restaurant ? "Menu" : "Shop"}\n\n${list}${list ? "\n\n" : ""}${url}`
                                const href = whatsappHref(whatsapp, text)
                                if (href) window.open(href, "_blank")
                                else void navigator.clipboard.writeText(text).then(() => toast.success("Catalog copied — add WhatsApp on Profile to share there"))
                            },
                        },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={() => { setEditing(null); setAdding(true) }}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
            </StudioDock>
            <Sheet open={importOpen} onOpenChange={setImportOpen}>
                <SheetContent
                    side="bottom"
                    className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-none"
                >
                    <SheetHeader className="border-b px-4 pb-4">
                        <SheetTitle>{restaurant ? "Import menu" : "Import shop"}</SheetTitle>
                        <SheetDescription>
                            {restaurant
                                ? "Paste a Swiggy, Zomato, or Uber Eats link. Review dishes before they go live."
                                : "Paste a shop URL, CSV, or a list of products."}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="px-4 py-4">
                        <ImportStudio
                            profileId={profileId}
                            role={role}
                            extras={extras}
                            initialHint="shop"
                            lockHint
                            embedded
                            onBindApply={setImportCtl}
                        />
                    </div>
                    {importCtl ? (
                        <div className="sticky bottom-0 border-t bg-background px-4 py-3">
                            <Button
                                className="h-11 w-full rounded-full"
                                disabled={!importCtl.count || importCtl.applying}
                                onClick={importCtl.apply}
                            >
                                {importCtl.label}
                            </Button>
                        </div>
                    ) : null}
                </SheetContent>
            </Sheet>
            <QuickAddSheet
                open={adding || !!editing}
                onOpenChange={(open) => {
                    setAdding(open)
                    if (!open) setEditing(null)
                }}
                profileId={profileId}
                product={editing}
                restaurant={restaurant}
                role={role}
            />
        </div>
    )
}

const COVER: Record<string, { bg: string; mid: string; ink: string }> = {
    PDF: { bg: "#0b3d32", mid: "#34d399", ink: "#ecfdf5" },
    VIDEO: { bg: "#1e1b4b", mid: "#818cf8", ink: "#e0e7ff" },
    AUDIO: { bg: "#431407", mid: "#fb923c", ink: "#ffedd5" },
    OTHER: { bg: "#172554", mid: "#60a5fa", ink: "#dbeafe" },
    PHYSICAL: { bg: "#111827", mid: "#00D7FF", ink: "#ecfeff" },
}

function Thumb({ product, className, compact = false }: { product: DigitalProduct; className?: string; compact?: boolean }) {
    const Icon = typeIcon[product.type] || Package
    const pal = COVER[product.type] || COVER.OTHER
    return (
        <div className={cn("relative overflow-hidden", className)} style={{ background: pal.bg }}>
            {product.thumbnailUrl || parseGallery(product.galleryUrls)[0] ? (
                <img src={product.thumbnailUrl || parseGallery(product.galleryUrls)[0]} alt="" className="h-full w-full object-cover" />
            ) : compact ? (
                <div className="flex h-full items-center justify-center" style={{ color: pal.mid }}>
                    <Icon className="h-5 w-5" />
                </div>
            ) : (
                <div className="absolute inset-0" style={{ color: pal.ink }}>
                    <div
                        className="absolute inset-x-3 top-5 bottom-8 rounded-xl"
                        style={{ background: pal.mid, opacity: 0.22, transform: "rotate(-4deg)" }}
                    />
                    <div className="absolute inset-x-4 top-7 bottom-6 rounded-xl bg-white/10" style={{ transform: "rotate(3deg)" }} />
                    <div className="relative flex h-full flex-col items-start justify-between p-4">
                        <span className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-70">{product.type}</span>
                        <Icon className="h-10 w-10 opacity-90" />
                    </div>
                </div>
            )}
        </div>
    )
}

function ProductRow({
    product,
    deleting,
    pending,
    onOpen,
    onToggle,
    onDelete,
}: {
    product: DigitalProduct
    deleting: boolean
    pending: boolean
    onOpen: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="flex items-center gap-2.5 border-b border-border/50 px-2.5 py-2 last:border-b-0">
            <button type="button" onClick={onOpen} className="shrink-0">
                <Thumb product={product} compact className="h-12 w-12 rounded-xl" />
            </button>
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{product.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {money(product.priceCents)}
                    {isPhysical(product.fulfillment) ? " · Physical" : ` · ${product.downloadCount} sold`}
                    {stockLabel(product.stock) ? ` · ${stockLabel(product.stock)}` : ""}
                    {!product.isActive ? " · Off" : ""}
                </p>
            </button>
            <Switch checked={product.isActive} disabled={pending} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

function ProductTile({
    product,
    deleting,
    pending,
    onOpen,
    onToggle,
    onDelete,
}: {
    product: DigitalProduct
    deleting: boolean
    pending: boolean
    onOpen: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <button type="button" onClick={onOpen} className="block w-full">
                <Thumb product={product} className="aspect-square w-full" />
            </button>
            <div className="flex flex-col gap-3 p-3">
                <button type="button" onClick={onOpen} className="min-h-[2.75rem] text-left">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{product.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {money(product.priceCents)}
                        {isPhysical(product.fulfillment) ? " · Physical" : ` · ${product.downloadCount} sold`}
                        {stockLabel(product.stock) ? ` · ${stockLabel(product.stock)}` : ""}
                        {!product.isActive ? " · Off" : ""}
                    </p>
                </button>
                <div className="flex items-center justify-between pt-0.5">
                    <Switch checked={product.isActive} disabled={pending} onCheckedChange={onToggle} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={onDelete} disabled={deleting}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
