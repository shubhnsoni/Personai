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

interface ProductFormProps {
    profileId: string
    product?: DigitalProduct
}

export function ProductForm({ profileId, product }: ProductFormProps) {
    const router = useRouter()
    const isEditing = !!product

    const [title, setTitle] = useState(product?.title || "")
    const [description, setDescription] = useState(product?.description || "")
    const [type, setType] = useState<ProductData["type"]>(
        (product?.type as ProductData["type"]) || "OTHER"
    )
    const [price, setPrice] = useState(
        product ? (product.priceCents / 100).toString() : ""
    )
    const [fileUrl, setFileUrl] = useState(product?.fileUrl || "")
    const [thumbnailUrl, setThumbnailUrl] = useState(product?.thumbnailUrl || "")
    const [isActive, setIsActive] = useState(product?.isActive ?? true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsSubmitting(true)
        try {
            const data: ProductData = {
                title: title.trim(),
                description: description.trim() || undefined,
                type,
                price: parseFloat(price) || 0,
                fileUrl: fileUrl.trim() || undefined,
                thumbnailUrl: thumbnailUrl.trim() || undefined,
                isActive,
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
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Product" : "Create New Product"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your digital product details."
                        : "Add a new digital product for your audience to purchase."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
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
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe your product..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select value={type} onValueChange={(val) => setType(val as ProductData["type"])}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
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
                        <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                        <Input
                            id="thumbnailUrl"
                            type="url"
                            placeholder="https://example.com/thumbnail.jpg"
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Cover image for your product
                        </p>
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

                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !title.trim()}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditing
                                    ? "Update Product"
                                    : "Create Product"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
