import type { DigitalProduct } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), create: vi.fn(), update: vi.fn(), ingest: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => "/dashboard/products", useSearchParams: () => new URLSearchParams() }))
vi.mock("@/app/actions/import", () => ({ ingestUrl: mocks.ingest, ingestText: vi.fn(), ingestFile: vi.fn(), applyImportBundle: vi.fn() }))
vi.mock("@/app/actions/products", () => ({ createProduct: mocks.create, updateProduct: mocks.update, deleteProduct: vi.fn(), setAllPrepMinutes: vi.fn(), setProductActive: vi.fn() }))
vi.mock("@/components/pricing-provider", () => ({ useMoney: () => (amount: number) => `$${amount / 100}` }))
vi.mock("@/components/shop/photo-stage", () => ({ PhotoStage: () => <div>Product photos</div> }))
vi.mock("@/components/ui/file-field", () => ({ FileField: () => <div>File picker</div> }))
vi.mock("@/components/shop/ar-studio", () => ({
    ArStudio: () => null,
    ArTrigger: ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick}>Add AR</button>,
}))
vi.mock("@/components/dashboard/ar-build-sheet", () => ({
    ArBuildSheet: ({ open, initialIds }: { open: boolean; initialIds?: string[] }) => open
        ? <section aria-label="Photoreal generation panel">Selection: {initialIds?.join(",") || "choose products"}</section> : null,
}))

import { ImportStudio } from "@/components/dashboard/import-studio"
import { ProductsList } from "@/components/dashboard/products-list"
import { QuickAddSheet } from "@/components/dashboard/quick-add-sheet"

const savedProduct: DigitalProduct = {
    id: "saved-cup", profileId: "shop", title: "Ceramic cup", type: "OTHER", fulfillment: "PHYSICAL",
    priceCents: 2400, currency: "USD", isActive: true, downloadCount: 0, stock: 5,
    thumbnailUrl: "/uploads/shop/cup.jpg", galleryUrls: null, variantsJson: null,
    description: null, fileUrl: null, subtitle: null, body: null, compareAtCents: null, highlights: null,
    sku: null, weightGrams: null, allowCod: false, category: null, diet: null, spiceLevel: null,
    serveWindow: null, prepMinutes: null, arModelUrl: null, arUsdzUrl: null, shipMode: "NONE", shipFeeCents: 0,
    createdAt: new Date("2026-09-09"), updatedAt: new Date("2026-09-09"),
}

beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})

describe("business-specific import interface", () => {
    it.each(["SHOP", "PHARMACY", "CONSULTANT", "CUSTOM"])("keeps food-delivery source options out of %s", role => {
        render(<ImportStudio profileId="shop" role={role} initialHint="shop" extras={{ surfaces: ["shop"], packs: ["menuDish"] }} />)
        for (const name of ["Swiggy", "Zomato", "Uber Eats"]) expect(screen.queryByRole("button", { name: new RegExp(`^${name} `) })).toBeNull()
        expect(screen.getByRole<HTMLTextAreaElement>("textbox").placeholder).not.toMatch(/swiggy|zomato|ubereats|dishes/i)
    })

    it.each(["RESTAURANT", "CAFE", "CLOUD_KITCHEN", "DHABA"])("offers restaurant sources for the existing %s role", role => {
        render(<ImportStudio profileId="cafe" role={role} />)
        for (const name of ["Swiggy", "Zomato", "Uber Eats"]) expect(screen.getByRole("button", { name: new RegExp(`^${name} `) })).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /^Zomato / }))
        expect(screen.getByRole<HTMLTextAreaElement>("textbox").placeholder).toMatch(/zomato/i)
    })

    it("removes a selected restaurant source and its placeholder when the business changes", () => {
        const { rerender } = render(<ImportStudio profileId="cafe" role="CAFE" initialHint="shop" />)
        fireEvent.click(screen.getByRole("button", { name: /^Swiggy / }))
        rerender(<ImportStudio profileId="shop" role="SHOP" initialHint="shop" />)
        expect(screen.queryByRole("button", { name: /^Swiggy / })).toBeNull()
        expect(screen.getByRole<HTMLTextAreaElement>("textbox").placeholder).not.toMatch(/swiggy/i)
        expect(mocks.ingest).not.toHaveBeenCalled()
    })
})

describe("Photoreal 3D discoverability", () => {
    it("opens the existing generation panel directly from the catalog, even before the first product", () => {
        render(<ProductsList profileId="shop" slug="ceramic-studio" role="SHOP" products={[]} />)
        fireEvent.click(screen.getByRole("button", { name: /^Photoreal 3D/ }))
        expect(screen.getByRole("region", { name: "Photoreal generation panel" }).textContent).toContain("choose products")
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.update).not.toHaveBeenCalled()
    })

    it("opens Photoreal 3D for the selected saved product without going through Add AR", () => {
        render(<ProductsList profileId="shop" slug="ceramic-studio" role="SHOP" products={[savedProduct]} />)
        fireEvent.click(screen.getByRole("button", { name: /Ceramic cup.*\$24/ }))
        const editor = screen.getByRole("dialog")
        expect(within(editor).getByText(/Uses the saved product photo/)).toBeTruthy()
        fireEvent.click(within(editor).getByRole("button", { name: /^Photoreal 3D/ }))
        expect(screen.getByRole("region", { name: "Photoreal generation panel" }).textContent).toContain("saved-cup")
        expect(mocks.update).not.toHaveBeenCalled()
    })

    it("explains how to reach generation after saving a new product", () => {
        render(<QuickAddSheet open onOpenChange={() => {}} profileId="shop" role="SHOP" />)
        expect(screen.getByText(/Save this product with a photo to use Photoreal 3D/)).toBeTruthy()
        expect(screen.queryByRole("button", { name: /^Photoreal 3D/ })).toBeNull()
    })

    it("preserves the existing AR surface rules for a business without the feature", () => {
        render(<ProductsList profileId="coach" slug="coach" role="COACH" products={[]} />)
        expect(screen.queryByRole("button", { name: /^Photoreal 3D/ })).toBeNull()
    })

    it("does not trust a mismatched restaurant prop when offering menu imports", () => {
        const { rerender } = render(<ProductsList profileId="shop" slug="shop" role="SHOP" restaurant products={[]} />)
        expect(screen.queryByRole("button", { name: /^Import menu/ })).toBeNull()
        rerender(<ProductsList profileId="cafe" slug="cafe" role="CAFE" products={[]} />)
        expect(screen.getByRole("button", { name: /^Import menu/ })).toBeTruthy()
    })
})
