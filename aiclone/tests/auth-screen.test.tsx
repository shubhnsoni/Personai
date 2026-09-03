import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"

/**
 * AuthScreen hydration against Clerk's client-only host.
 *
 * Next logged this exact recoverable error on /sign-in (auth-screen.tsx:89):
 *
 *   <ClerkHostRenderer component="SignIn" ...>
 *   + <div data-clerk-component="SignIn">
 *
 * ClerkHostRenderer omits that host div from SSR HTML and inserts it on the first
 * client render. jsdom has `window` during renderToString, so `typeof window` cannot
 * tell the two passes apart — the hoisted flag below is the server pass, matching
 * what the real Clerk renderer does on Node.
 */

const nav = vi.hoisted(() => ({ pathname: "/sign-in" }))
const clerkSsr = vi.hoisted(() => ({ pass: false }))

vi.mock("next/navigation", () => ({
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

vi.mock("@clerk/nextjs", () => ({
    SignIn: function SignIn() {
        if (clerkSsr.pass) return null
        return <div data-clerk-component="SignIn">sign-in host</div>
    },
    SignUp: function SignUp() {
        if (clerkSsr.pass) return null
        return <div data-clerk-component="SignUp">sign-up host</div>
    },
}))

const { AuthScreen } = await import("@/components/auth/auth-screen")

function ssrHtml() {
    clerkSsr.pass = true
    try {
        return renderToString(<AuthScreen />)
    } finally {
        clerkSsr.pass = false
    }
}

describe("AuthScreen - Clerk host hydration", () => {
    beforeEach(() => {
        nav.pathname = "/sign-in"
    })

    afterEach(() => {
        clerkSsr.pass = false
    })

    it("does not emit Clerk's client-only host during SSR", () => {
        const html = ssrHtml()
        expect(html).toContain("Welcome back")
        expect(html).not.toContain("data-clerk-component")
    })

    it("hydrates without a recoverable mismatch, then mounts the Clerk host", async () => {
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
        expect(container.querySelector("[data-clerk-component='SignIn']")).not.toBeNull()

        act(() => root?.unmount())
        container.remove()
    })
})
