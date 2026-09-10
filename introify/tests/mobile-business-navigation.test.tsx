import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { AnchorHTMLAttributes } from "react"

const state = vi.hoisted(() => ({
    switchBusiness: vi.fn(), push: vi.fn(), refresh: vi.fn(), error: vi.fn(), close: vi.fn(),
}))
vi.mock("@/app/actions/billing-team", () => ({ switchBusiness: state.switchBusiness }))
vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: state.push, refresh: state.refresh }),
}))
vi.mock("sonner", () => ({ toast: { error: state.error } }))
vi.mock("@/components/dashboard/studio-sign-out", () => ({ StudioSignOut: () => <button>Sign out</button> }))
vi.mock("next/link", () => ({
    default: ({ onNavigate, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { onNavigate?: (event: { preventDefault: () => void }) => void }) => (
        <a {...props} onClick={(event) => {
            onClick?.(event)
            const canceled = event.defaultPrevented
            event.preventDefault()
            if (!canceled && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
                onNavigate?.({ preventDefault: () => {} })
            }
        }} />
    ),
}))

import { BusinessSwitcher } from "@/components/dashboard/business-switcher"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"

const businesses = [
    { id: "owned", name: "My studio", role: "OWNER" },
    { id: "invited", name: "Partner studio", role: "VIEWER" },
]
function Drawer() {
    return <MobileSidebar open onOpenChange={state.close} role="SHOP" businesses={businesses} activeProfileId="owned" />
}

beforeEach(() => { vi.resetAllMocks() })

describe("mobile business navigation", () => {
    it("labels the drawer's own selector above navigation while retaining role-specific navigation", () => {
        render(<><BusinessSwitcher businesses={businesses} activeId="owned" /><Drawer /></>)
        const dialog = screen.getByRole("dialog", { name: "Menu" })
        const select = within(dialog).getByRole("combobox", { name: "Business" }) as HTMLSelectElement
        const logo = within(dialog).getByRole("link", { name: "Introify home" })
        expect(logo.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(select.value).toBe("owned")
        expect(Array.from(select.options).map(option => option.text)).toEqual(["My studio · owner", "Partner studio · viewer"])
        const selectors = Array.from(document.querySelectorAll("select"))
        expect(new Set(selectors.map(element => element.id)).size).toBe(2)
        expect(select.labels?.[0]?.control).toBe(select)
        expect(select.compareDocumentPosition(within(dialog).getByRole("button", { name: "Home" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(within(dialog).queryByRole("button", { name: "Courses" })).toBeNull()
    })

    it("waits for successful server switching before closing and refreshing the business", async () => {
        let finish!: () => void
        state.switchBusiness.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
        render(<Drawer />)
        const select = screen.getByRole("combobox", { name: "Business" }) as HTMLSelectElement
        fireEvent.change(select, { target: { value: "invited" } })
        expect(state.switchBusiness).toHaveBeenCalledWith("invited")
        expect(select.disabled).toBe(true)
        expect(state.close).not.toHaveBeenCalled()
        expect(state.push).not.toHaveBeenCalled()
        await act(async () => { finish() })
        expect(state.push).toHaveBeenCalledWith("/dashboard")
        expect(state.refresh).toHaveBeenCalledOnce()
        expect(state.close).toHaveBeenCalledWith(false)
    })

    it("keeps the drawer and previous business available when access is denied", async () => {
        state.switchBusiness.mockRejectedValue(new Error("This business is unavailable."))
        render(<Drawer />)
        const select = screen.getByRole("combobox", { name: "Business" }) as HTMLSelectElement
        fireEvent.change(select, { target: { value: "invited" } })
        await waitFor(() => expect(state.error).toHaveBeenCalledWith("This business is unavailable."))
        expect(select.disabled).toBe(false)
        expect(select.value).toBe("owned")
        expect(state.close).not.toHaveBeenCalled()
        expect(state.push).not.toHaveBeenCalled()
    })

    it("closes for ordinary team navigation while preserving modified link clicks", () => {
        render(<Drawer />)
        const team = screen.getByRole("link", { name: "Businesses & team" })
        fireEvent.click(team, { ctrlKey: true })
        expect(state.close).not.toHaveBeenCalled()
        fireEvent.click(team)
        expect(state.close).toHaveBeenCalledWith(false)
        expect(state.switchBusiness).not.toHaveBeenCalled()
    })
})
