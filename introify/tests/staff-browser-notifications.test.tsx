import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

const { StaffBrowserNotifications } = await import("@/components/dashboard/staff-browser-notifications")

class FakeNotification {
    static permission: NotificationPermission = "default"
    static instances: Array<{ title: string; options: NotificationOptions }> = []
    static requestPermission = vi.fn(async () => {
        FakeNotification.permission = "granted"
        return "granted" as NotificationPermission
    })
    title: string
    options: NotificationOptions
    onclick: ((this: Notification, ev: Event) => unknown) | null = null
    constructor(title: string, options: NotificationOptions = {}) {
        this.title = title
        this.options = options
        FakeNotification.instances.push({ title, options })
    }
    close() {}
}

describe("StaffBrowserNotifications", () => {
    beforeEach(() => {
        FakeNotification.permission = "default"
        FakeNotification.instances = []
        FakeNotification.requestPermission.mockClear()
        vi.stubGlobal("Notification", FakeNotification)
        window.localStorage.clear()
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({ alerts: [] }),
        })) as unknown as typeof fetch)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        window.localStorage.clear()
    })

    it("shows a polite Enable prompt for staff and remembers Not now", async () => {
        render(<StaffBrowserNotifications />)
        expect(await screen.findByText(/Turn on browser alerts for live chat and hotel requests/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Not now" }))
        await waitFor(() => {
            expect(screen.queryByText(/Turn on browser alerts for live chat and hotel requests/)).toBeNull()
        })
        expect(window.localStorage.getItem("introify.staff-browser-alerts.dismissed")).toBe("1")
    })

    it("requests Notification permission from Enable", async () => {
        render(<StaffBrowserNotifications />)
        fireEvent.click(await screen.findByRole("button", { name: "Enable" }))
        await waitFor(() => {
            expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
        })
    })
})
