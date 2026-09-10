import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { KitPicker } from "@/components/dashboard/kit-picker"
import { extrasFromAddons, suggestedAddons, type AddonId } from "@/lib/onboarding-needs"
import { kitFamily } from "@/lib/try-kits"

function Harness({ role = "JEWELRY_RETAIL", goal = "SELL_PRODUCTS", addons = [] as AddonId[] }) {
    const [state, setState] = useState({ role, goal, extras: extrasFromAddons(role, [...suggestedAddons(role), ...addons]) })
    return (
        <KitPicker
            role={state.role}
            goal={state.goal}
            extras={state.extras}
            onRole={(nextRole, nextGoal) => setState({
                role: nextRole,
                goal: nextGoal,
                extras: extrasFromAddons(nextRole, [...suggestedAddons(nextRole), ...(state.extras.addons || []).filter((id) => !suggestedAddons(nextRole).includes(id as AddonId)) as AddonId[]]),
            })}
            onGoal={(nextGoal) => setState((cur) => ({ ...cur, goal: nextGoal }))}
            onAddons={(next) => setState((cur) => ({ ...cur, extras: extrasFromAddons(cur.role, next) }))}
        />
    )
}

describe("profile kit picker", () => {
    it("groups kits by work instead of dumping every role as a chip", () => {
        expect(kitFamily("JEWELRY_RETAIL")).toBe("shop")
        expect(kitFamily("CAFE")).toBe("food")
        expect(kitFamily("CATERER")).toBe("food")
        expect(kitFamily("PLUMBER")).toBe("book")
        expect(kitFamily("TUTOR")).toBe("teach")
        expect(kitFamily("DESIGNER")).toBe("studio")
        render(<Harness />)
        expect(screen.getByText("Jewellery store")).toBeTruthy()
        expect(screen.queryByRole("option", { name: /Kirana/ })).toBeNull()
        expect(screen.queryByRole("button", { name: "Kirana" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Change kit" }))
        expect(screen.getByRole("tab", { name: "Shop" })).toBeTruthy()
        expect(screen.getByRole("tab", { name: "Food" })).toBeTruthy()
        fireEvent.click(screen.getByRole("tab", { name: "Shop" }))
        fireEvent.click(screen.getByRole("option", { name: /Kirana/ }))
        expect(screen.getByText("Kirana")).toBeTruthy()
        expect(screen.queryByRole("listbox")).toBeNull()
    })

    it("keeps kit tools as included rows and only lets extras toggle", () => {
        render(<Harness role="CONSULTANT" goal="TAKE_APPOINTMENTS" />)
        const included = screen.getByText("Included with this kit").closest("div")!
        expect(within(included).getByText("Leads")).toBeTruthy()
        expect(within(included).getByText("Services")).toBeTruthy()
        expect(within(included).queryByRole("button", { name: /Leads/ })).toBeNull()
        fireEvent.click(screen.getByText(/Add more tools/))
        const extra = screen.getByRole("button", { name: /Shop/ })
        expect(extra.getAttribute("aria-pressed")).toBe("false")
        fireEvent.click(extra)
        expect(screen.getByRole("button", { name: /Shop/ }).getAttribute("aria-pressed")).toBe("true")
        fireEvent.click(screen.getByRole("button", { name: /Shop/ }))
        expect(screen.getByRole("button", { name: /Shop/ }).getAttribute("aria-pressed")).toBe("false")
    })
})
