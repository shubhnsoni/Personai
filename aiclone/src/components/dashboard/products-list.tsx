"use client"

import { useState } from "react"
import Link from "next/link"
import { DigitalProduct } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    FileText,
    Video,
    Music,
    Package,
    Download,
} from "lucide-react"
import { deleteProduct } from "@/app/actions/products"

interface ProductsListProps {
    profileId: string
    products: DigitalProduct[]
}

const typeConfig: Record<string, { icon: typeof FileText; color: string }> = {
    PDF: { icon: FileText, color: "bg-red-500/10 text-red-600 border-red-200" },
    VIDEO: { icon: Video, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
    AUDIO: { icon: Music, color: "bg-purple-500/10 text-purple-600 border-purple-200" },
    OTHER: { icon: Package, color: "bg-gray-500/10 text-gray-600 border-gray-200" },
}

export function ProductsList({ profileId, products }: ProductsListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return

        setDeletingId(id)
        try {
            await deleteProduct(id)
        } catch (error) {
            console.error("Failed to delete product:", error)
        } finally {
            setDeletingId(null)
        }
    }

    const getTypeConfig = (type: string) => {
        return typeConfig[type] || typeConfig.OTHER
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Digital Products</h2>
                    <p className="text-muted-foreground">
                        Manage your downloadable products like PDFs, videos, and audio files.
                    </p>
                </div>
                <Link href="/dashboard/products/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                </Link>
            </div>

            {products.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No products yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Start selling digital products to your audience. Add your first
                            product to get started.
                        </p>
                        <Link href="/dashboard/products/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Your First Product
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => {
                        const config = getTypeConfig(product.type)
                        const TypeIcon = config.icon
                        const isDeleting = deletingId === product.id

                        return (
                            <Card key={product.id} className="relative overflow-hidden">
                                {product.thumbnailUrl ? (
                                    <div className="aspect-video w-full overflow-hidden bg-muted">
                                        <img
                                            src={product.thumbnailUrl}
                                            alt={product.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                        <TypeIcon className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                )}

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-medium line-clamp-2">
                                            {product.title}
                                        </CardTitle>
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 ${config.color}`}
                                        >
                                            {product.type}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="font-bold text-lg">
                                            {product.priceCents === 0
                                                ? "Free"
                                                : `$${(product.priceCents / 100).toFixed(2)}`}
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <Download className="mr-1 h-3 w-3" />
                                            {product.downloadCount}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Badge variant={product.isActive ? "default" : "secondary"}>
                                            {product.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/products/${product.id}/edit`}
                                            className="flex-1"
                                        >
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(product.id)}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
