"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DigitalProduct } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createProduct, updateProduct, type ProductData } from "@/app/actions/products"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { FileField } from "@/components/ui/file-field"

interface ProductFormProps {
    profileId: string
    product?: DigitalProduct
}

export function ProductForm({ profileId, product }: ProductFormProps) {
    const router = useRouter()
    const isEditing = !!product

    const [title, setTitle] = useState(product?.title || "")
    const [description, setDescription] = useState(product?.description || "")
    const [subtitle, setSubtitle] = useState(product?.subtitle || "")
    const [body, setBody] = useState(product?.body || "")
    const [highlights, setHighlights] = useState(() => {
        const raw = product?.highlights
        if (!raw) return ""
        try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.join("\n") : String(raw)
        } catch { return String(raw) }
    })
    const [compareAt, setCompareAt] = useState(
        product?.compareAtCents ? String(product.compareAtCents / 100) : ""
    )
    const [type, setType] = useState<ProductData["type"]>(
        (product?.type as ProductData["type"]) || "OTHER"
    )
    const [price, setPrice] = useState(
        product ? (product.priceCents / 100).toString() : ""
    )
    const [fileUrl, setFileUrl] = useState(product?.fileUrl || "")
    const [thumbnailUrl, setThumbnailUrl] = useState(product?.thumbnailUrl || "")
    const [isActive, setIsActive] = useState(product?.isActive ?? true)
    const [fulfillment, setFulfillment] = useState<"DIGITAL" | "PHYSICAL" | "BOTH">(
        (product?.fulfillment as "DIGITAL" | "PHYSICAL" | "BOTH") || (product?.type === "PHYSICAL" ? "PHYSICAL" : "DIGITAL"),
    )
    const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "")
    const [sku, setSku] = useState(product?.sku || "")
    const [category, setCategory] = useState(product?.category || "")
    const [variantsText, setVariantsText] = useState(() => {
        try {
            const parsed = product?.variantsJson ? JSON.parse(product.variantsJson) : []
            return Array.isArray(parsed) ? parsed.map((v: { name?: string }) => v.name || "").filter(Boolean).join("\n") : ""
        } catch {
            return product?.variantsJson || ""
        }
    })
    const [allowCod, setAllowCod] = useState(product?.allowCod ?? false)
    const [shipMode, setShipMode] = useState<"NONE" | "PICKUP" | "DELIVER" | "BOTH">(
        (product?.shipMode as "NONE" | "PICKUP" | "DELIVER" | "BOTH") || "NONE",
    )
    const [shipFee, setShipFee] = useState(product?.shipFeeCents ? String(product.shipFeeCents / 100) : "")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploading, setUploading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsSubmitting(true)
        try {
            const lines = highlights.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
            const data: ProductData = {
                title: title.trim(),
                description: description.trim() || undefined,
                subtitle: subtitle.trim() || undefined,
                body: body.trim() || undefined,
                type,
                price: parseFloat(price) || 0,
                compareAtCents: compareAt ? Math.round(parseFloat(compareAt) * 100) : undefined,
                highlights: lines.length ? JSON.stringify(lines) : undefined,
                fileUrl: fileUrl.trim() || undefined,
                thumbnailUrl: thumbnailUrl.trim() || undefined,
                isActive,
                fulfillment,
                stock: stock === "" ? null : parseInt(stock, 10),
                sku: sku.trim() || undefined,
                category: category.trim() || undefined,
                variantsText,
                allowCod,
                shipMode,
                shipFeeCents: shipFee ? Math.round(parseFloat(shipFee) * 100) : 0,
            }

            if (isEditing && product) {
                await updateProduct(product.id, data)
            } else {
                await createProduct(profileId, data)
            }

            router.push("/dashboard/products")
            router.refresh()
        } catch (error) {
            console.error("Failed to save product:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/products")
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Product" : "Create New Product"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update this item. Physical or digital."
                        : "Photo, name, price — or fill the extra fields if you need them."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Ultimate Guide to Web Development"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Subtitle</Label>
                        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One-line pitch" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Short pitch</Label>
                        <Textarea
                            id="description"
                            placeholder="Shown on cards"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Product page</Label>
                        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Longer copy for the shop page" />
                    </div>
                    <div className="space-y-2">
                        <Label>What&apos;s included (one per line)</Label>
                        <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                        <Label>Compare-at price</Label>
                        <Input type="number" min="0" step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select value={type} onValueChange={(val) => setType(val as ProductData["type"])}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PHYSICAL">Physical</SelectItem>
                                    <SelectItem value="PDF">PDF</SelectItem>
                                    <SelectItem value="VIDEO">Video</SelectItem>
                                    <SelectItem value="AUDIO">Audio</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price">Price (USD)</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {(["PHYSICAL", "DIGITAL", "BOTH"] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => {
                                    setFulfillment(kind)
                                    if (kind === "PHYSICAL") setType("PHYSICAL")
                                }}
                                className={`h-10 rounded-full text-xs font-medium ${fulfillment === kind ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                            >
                                {kind === "PHYSICAL" ? "Physical" : kind === "DIGITAL" ? "Digital" : "Both"}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Stock</Label>
                            <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="blank = don’t track" />
                        </div>
                        <div className="space-y-2">
                            <Label>SKU</Label>
                            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="optional" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Snacks, Gold, Notes…" />
                    </div>
                    {fulfillment !== "DIGITAL" ? (
                        <>
                            <div className="space-y-2">
                                <Label>Variants (one per line)</Label>
                                <Textarea value={variantsText} onChange={(e) => setVariantsText(e.target.value)} rows={3} placeholder={"S\nM\nL"} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>How they get it</Label>
                                    <Select value={shipMode} onValueChange={(v) => setShipMode(v as typeof shipMode)}>
                                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Ask me</SelectItem>
                                            <SelectItem value="PICKUP">Pickup</SelectItem>
                                            <SelectItem value="DELIVER">We deliver</SelectItem>
                                            <SelectItem value="BOTH">Pickup or deliver</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Delivery fee</Label>
                                    <Input type="number" min="0" step="0.01" value={shipFee} onChange={(e) => setShipFee(e.target.value)} placeholder="0" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label>Cash on delivery</Label>
                                    <p className="text-sm text-muted-foreground">Buyer can order without paying first</p>
                                </div>
                                <Switch checked={allowCod} onCheckedChange={setAllowCod} />
                            </div>
                        </>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="fileUrl">File URL</Label>
                        <Input
                            id="fileUrl"
                            type="url"
                            placeholder="https://example.com/your-file.pdf"
                            value={fileUrl}
                            onChange={(e) => setFileUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Direct link to your digital product file
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="thumbnailUrl">Cover image</Label>
                        {thumbnailUrl && (
                            <img src={thumbnailUrl} alt="" className="h-28 w-full rounded-lg object-cover" />
                        )}
                        <FileField
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={uploading}
                            onFile={async (file) => {
                                if (!file) return
                                setUploading(true)
                                try {
                                    const body = new FormData()
                                    body.append("file", file)
                                    const res = await fetch("/api/upload", { method: "POST", body })
                                    const json = await res.json()
                                    if (json.url) setThumbnailUrl(json.url)
                                } finally {
                                    setUploading(false)
                                }
                            }}
                        />
                        <Input
                            id="thumbnailUrl"
                            type="url"
                            placeholder="or paste https://..."
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Make this product visible and available for purchase
                            </p>
                        </div>
                        <Switch
                            id="isActive"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                        />
                    </div>

                </form>
            </CardContent>
        </Card>
        <StudioDock>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button type="submit" form="product-form" disabled={isSubmitting || !title.trim()}>
                {isSubmitting ? "Saving..." : isEditing ? "Save product" : "Create product"}
            </Button>
        </StudioDock>
        </>
    )
}
