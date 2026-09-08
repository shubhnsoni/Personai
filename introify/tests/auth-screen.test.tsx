import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"

const nav = vi.hoisted(() => ({ pathname: "/sign-in" }))

vi.mock("next/navigation", () => ({
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

const { AuthScreen } = await import("@/components/auth/auth-screen")

function ssrHtml() {
    return renderToString(<AuthScreen />)
}

describe("AuthScreen", () => {
    beforeEach(() => {
        nav.pathname = "/sign-in"
    })

    afterEach(() => {
        document.body.replaceChildren()
    })

    it("renders the sign-in chrome without a Clerk host", () => {
        const html = ssrHtml()
        expect(html).toContain("Welcome back")
        expect(html).not.toContain("data-clerk-component")
    })

    it("hydrates without a recoverable mismatch", async () => {
        const html = ssrHtml()
        const container = document.createElement("div")
        document.body.appendChild(container)
        container.innerHTML = html

        const recoverableErrors: unknown[] = []
        let root: ReturnType<typeof hydrateRoot> | undefined
        await act(async () => {
            root = hydrateRoot(container, <AuthScreen />, {
                onRecoverableError: (error) => recoverableErrors.push(error),
            })
            await Promise.resolve()
        })

        expect(recoverableErrors).toHaveLength(0)
        act(() => root?.unmount())
        container.remove()
    })
})
