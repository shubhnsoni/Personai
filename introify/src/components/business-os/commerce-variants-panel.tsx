"use client"

import { Shapes } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    type OptionView,
    type ProductView,
    type VariantView,
    commerceErrorCopy,
    commerceRequest,
    isAbort,
    money,
} from "./commerce-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing variants panel.
 *
 * A variant is the sellable unit. Every row is a persisted ProductVariant read through
 * /api/platform/products/[productId]/variants. Prices are the server's resolved figures: a
 * variant with no price of its own shows the product's, and the screen says which it is
 * rather than silently copying a number.
 *
 * The legacy `variantsJson` blob on the product is deliberately not read here. It only ever
 * held a name, so it is not a source of truth for anything this panel shows.
 */

export function CommerceVariantsPanel({ workspaceId }: { workspaceId: string }) {
    const [products, setProducts] = useState<readonly ProductView[] | null>(null)
    const [selectedProductId, setSelectedProductId] = useState("")
    const [variants, setVariants] = useState<readonly VariantView[] | null>(null)
    const [options, setOptions] = useState<readonly OptionView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [revision, setRevision] = useState(0)
    const [newTitle, setNewTitle] = useState("")
    const [newSku, setNewSku] = useState("")
    const [optionName, setOptionName] = useState("")

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setProducts(null)
            return
        }
        const controller = new AbortController()
        setProducts(null)
        setError(null)
        commerceRequest<{ products: readonly ProductView[] }>(
            `/api/platform/products?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setProducts(data.products))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    useEffect(() => {
        if (!selectedProductId || !workspaceId) {
            setVariants(null)
            setOptions(null)
            return
        }
        const controller = new AbortController()
        const options_ = { signal: controller.signal }
        const query = `workspaceId=${encodeURIComponent(workspaceId)}`
        const base = `/api/platform/products/${encodeURIComponent(selectedProductId)}`
        setVariants(null)
        setOptions(null)
        Promise.all([
            commerceRequest<{ variants: readonly VariantView[] }>(`${base}/variants?${query}`, options_),
            commerceRequest<{ options: readonly OptionView[] }>(`${base}/options?${query}`, options_),
        ])
            .then(([v, o]) => {
                setVariants(v.variants)
                setOptions(o.options)
            })
            .catch((cause) => {
                if (isAbort(cause)) return
                setActionError(cause)
            })
        return () => controller.abort()
    }, [selectedProductId, workspaceId, revision])

    const mutate = useCallback(
        async (key: string, url: string, method: string, payload: Record<string, unknown>) => {
            setBusy(key)
            setActionError(null)
            try {
                await commerceRequest(url, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, ...payload }),
                })
                reload()
                return true
            } catch (cause) {
                setActionError(cause)
                return false
            } finally {
                setBusy("")
            }
        },
        [reload, workspaceId],
    )

    if (error) {
        const copy = commerceErrorCopy(error)
        return (
            <Card>
                <CardContent>
                    <ErrorState title={copy.title} description={copy.description} />
                </CardContent>
            </Card>
        )
    }

    const selectedProduct = products?.find((p) => p.id === selectedProductId) ?? null

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Product variants</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    A variant is the sellable unit: stock, reservations, shipments and returns all point at one. Every
                    product has one default variant, which inherits the product price rather than copying it.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<Shapes aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its products."
                    />
                ) : null}

                {workspaceId && products === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading products</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={commerceErrorCopy(actionError).title}
                        description={commerceErrorCopy(actionError).description}
                    />
                ) : null}

                {products?.length === 0 ? (
                    <EmptyState
                        icon={<Shapes aria-hidden="true" />}
                        title="No products yet"
                        description="Variants belong to products. None exist in this workspace, and no sample products are shown."
                    />
                ) : null}

                {products && products.length > 0 ? (
                    <ul className="space-y-2">
                        {products.slice(0, 25).map((product) => (
                            <li key={product.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">{product.title}</span>
                                    <Badge variant={product.isActive ? "default" : "secondary"}>
                                        {product.variantCount === 0
                                            ? "no variants yet"
                                            : `${product.variantCount} variant${product.variantCount === 1 ? "" : "s"}`}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {money(product.priceCents, product.currency)} ·{" "}
                                    {product.sku ? `SKU ${product.sku}` : "no SKU"} · {product.fulfillment.toLowerCase()}
                                </p>
                                <div className="mt-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-expanded={selectedProductId === product.id}
                                        onClick={() =>
                                            setSelectedProductId(selectedProductId === product.id ? "" : product.id)
                                        }
                                    >
                                        {selectedProductId === product.id ? "Hide variants" : "Show variants"}
                                    </Button>
                                </div>

                                {selectedProductId === product.id ? (
                                    <div className="mt-3 space-y-4 border-t border-border/70 pt-3">
                                        {variants === null || options === null ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading variants</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : (
                                            <>
                                                <section className="space-y-2">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Options
                                                    </h5>
                                                    {options.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            No options defined. A product without options still sells
                                                            through its default variant.
                                                        </p>
                                                    ) : (
                                                        <ul className="space-y-1 text-xs">
                                                            {options.map((option) => (
                                                                <li key={option.id}>
                                                                    <span className="font-medium">{option.name}</span>:{" "}
                                                                    {option.values.length === 0
                                                                        ? "no values yet"
                                                                        : option.values.map((v) => v.value).join(", ")}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`option-name-${product.id}`}>
                                                                New option name
                                                            </Label>
                                                            <Input
                                                                id={`option-name-${product.id}`}
                                                                value={optionName}
                                                                onChange={(event) => setOptionName(event.target.value)}
                                                                placeholder="Size"
                                                            />
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            disabled={busy === `opt:${product.id}` || !optionName.trim()}
                                                            onClick={async () => {
                                                                const ok = await mutate(
                                                                    `opt:${product.id}`,
                                                                    `/api/platform/products/${encodeURIComponent(product.id)}/options`,
                                                                    "POST",
                                                                    { name: optionName },
                                                                )
                                                                if (ok) setOptionName("")
                                                            }}
                                                        >
                                                            Add option
                                                        </Button>
                                                    </div>
                                                </section>

                                                <section className="space-y-2">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Variants
                                                    </h5>
                                                    {variants.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            No variant record exists yet. One is created automatically
                                                            the first time stock is opened for this product.
                                                        </p>
                                                    ) : (
                                                        <ul className="space-y-2">
                                                            {variants.map((variant) => (
                                                                <li
                                                                    key={variant.id}
                                                                    className="rounded-lg border border-border/70 p-2 text-sm"
                                                                >
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span>{variant.title}</span>
                                                                        <span className="flex gap-1">
                                                                            {variant.isDefault ? (
                                                                                <Badge variant="secondary">Default</Badge>
                                                                            ) : null}
                                                                            <Badge
                                                                                variant={
                                                                                    variant.isActive
                                                                                        ? "default"
                                                                                        : "destructive"
                                                                                }
                                                                            >
                                                                                {variant.isActive ? "Active" : "Inactive"}
                                                                            </Badge>
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {money(
                                                                            variant.effectivePriceCents,
                                                                            product.currency,
                                                                        )}
                                                                        {variant.priceCents === null
                                                                            ? " · inherited from the product"
                                                                            : " · set on this variant"}
                                                                        {variant.sku ? ` · SKU ${variant.sku}` : " · no SKU"}
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled={busy === `var:${variant.id}`}
                                                                            onClick={() =>
                                                                                mutate(
                                                                                    `var:${variant.id}`,
                                                                                    `/api/platform/product-variants/${encodeURIComponent(variant.id)}`,
                                                                                    "PATCH",
                                                                                    { isActive: !variant.isActive },
                                                                                )
                                                                            }
                                                                        >
                                                                            {variant.isActive
                                                                                ? "Deactivate"
                                                                                : "Reactivate"}
                                                                        </Button>
                                                                    </div>
                                                                    {variant.isActive ? (
                                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                                            Deactivating is refused while units are
                                                                            promised to orders, so a live promise cannot
                                                                            be stranded.
                                                                        </p>
                                                                    ) : null}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}

                                                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`variant-title-${product.id}`}>
                                                                New variant name
                                                            </Label>
                                                            <Input
                                                                id={`variant-title-${product.id}`}
                                                                value={newTitle}
                                                                onChange={(event) => setNewTitle(event.target.value)}
                                                                placeholder="Large"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`variant-sku-${product.id}`}>
                                                                SKU (optional)
                                                            </Label>
                                                            <Input
                                                                id={`variant-sku-${product.id}`}
                                                                value={newSku}
                                                                onChange={(event) => setNewSku(event.target.value)}
                                                                placeholder="WID-L"
                                                            />
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            disabled={busy === `newvar:${product.id}` || !newTitle.trim()}
                                                            onClick={async () => {
                                                                const ok = await mutate(
                                                                    `newvar:${product.id}`,
                                                                    `/api/platform/products/${encodeURIComponent(product.id)}/variants`,
                                                                    "POST",
                                                                    {
                                                                        title: newTitle,
                                                                        ...(newSku.trim() ? { sku: newSku } : {}),
                                                                    },
                                                                )
                                                                if (ok) {
                                                                    setNewTitle("")
                                                                    setNewSku("")
                                                                }
                                                            }}
                                                        >
                                                            Add variant
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        A new variant leaves its price blank, meaning it inherits the
                                                        product price. It is never created as the default.
                                                    </p>
                                                </section>
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}

                {selectedProduct && products && products.length > 25 ? (
                    <p className="text-xs text-muted-foreground">
                        Showing the 25 most recent products of {products.length}.
                    </p>
                ) : null}
            </CardContent>
        </Card>
    )
}
