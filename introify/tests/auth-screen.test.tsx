import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, type ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import Link from "next/link"
import { ThemeProvider } from "@/components/theme-provider"

const nav = vi.hoisted(() => ({ pathname: "/sign-in" }))

vi.mock("next/navigation", () => ({
    usePathname: () => nav.pathname,
}))

const { AuthScreen } = await import("@/components/auth/auth-screen")
const { AuthLoading } = await import("@/components/auth/auth-loading")

function AuthFrame({ children = null }: { children?: ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="pl-theme">
            <AuthScreen>{children}</AuthScreen>
        </ThemeProvider>
    )
}

function VerificationStep({ onAlternative = () => {} }: { onAlternative?: () => void }) {
    return (
        <div>
            <header className="cl-header au-cl-header">
                <h1 className="cl-headerTitle au-cl-title">Check your email</h1>
                <p className="cl-headerSubtitle au-cl-subtitle">Enter the code we sent to continue.</p>
            </header>
            <label className="cl-formFieldLabel au-cl-label" htmlFor="verification-code">Verification code</label>
            <input id="verification-code" className="cl-formFieldInput au-cl-input" autoComplete="one-time-code" />
            <button type="button" onClick={onAlternative}>Use another method</button>
            <Link href="/sign-in/reset-password">Forgot password?</Link>
            <footer className="cl-footer au-cl-footer">
                <Link href="/sign-up">Create an account</Link>
            </footer>
        </div>
    )
}

beforeEach(() => {
    nav.pathname = "/sign-in"
    localStorage.removeItem("pl-theme")
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.removeProperty("color-scheme")
    vi.stubGlobal("matchMedia", vi.fn(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })))
})

afterEach(() => {
    cleanup()
    localStorage.removeItem("pl-theme")
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.removeProperty("color-scheme")
})

describe("AuthScreen", () => {
    it("uses the current sign-in or sign-up route, including nested verification routes and navigation", () => {
        nav.pathname = "/sign-up/verify-email-address"
        const view = render(<AuthFrame />)
        expect(screen.getByRole("region", { name: "Create your Introify account" })).toBeTruthy()
        expect(screen.getByText("There’s more to you.")).toBeTruthy()
        expect(screen.getByText("Let’s show it.")).toBeTruthy()
        expect(screen.getByText("Start on Free. No card required.")).toBeTruthy()

        nav.pathname = "/sign-in/factor-one"
        view.rerender(<AuthFrame />)
        expect(screen.getByRole("region", { name: "Sign in to Introify" })).toBeTruthy()
        expect(screen.getByText("Good to have")).toBeTruthy()
        expect(screen.getByText("you back.")).toBeTruthy()
        expect(screen.queryByText("Let’s show it.")).toBeNull()

        nav.pathname = "/sign-up"
        view.rerender(<AuthFrame />)
        expect(screen.getByRole("region", { name: "Create your Introify account" })).toBeTruthy()
        expect(screen.queryByText("you back.")).toBeNull()
    })

    it("provides a focusable form destination and native home, contact, and policy links", () => {
        render(<AuthFrame />)
        const skipLink = screen.getByRole<HTMLAnchorElement>("link", { name: "Skip to account form" })
        const target = document.querySelector<HTMLElement>(skipLink.getAttribute("href")!)
        expect(target).not.toBeNull()
        target!.focus()
        expect(document.activeElement).toBe(target)

        expect(screen.getByRole("link", { name: "Introify home" }).getAttribute("href")).toBe("/")
        expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/")
        expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe("/privacy")
        const footer = within(screen.getByRole("navigation", { name: "Account page links" }))
        for (const [name, href] of [["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"]]) {
            expect(footer.getByRole("link", { name }).getAttribute("href")).toBe(href)
        }
    })

    it("retains the child step heading, input label, recovery links, and working alternative action", () => {
        const onAlternative = vi.fn()
        render(<AuthFrame><VerificationStep onAlternative={onAlternative} /></AuthFrame>)
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
        expect(screen.getByRole("heading", { level: 1, name: "Check your email" })).toBeTruthy()
        expect(screen.getByText("Enter the code we sent to continue.")).toBeTruthy()
        const code = screen.getByRole<HTMLInputElement>("textbox", { name: "Verification code" })
        fireEvent.change(code, { target: { value: "123456" } })
        expect(code.value).toBe("123456")
        fireEvent.click(screen.getByRole("button", { name: "Use another method" }))
        expect(onAlternative).toHaveBeenCalledOnce()
        expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/sign-in/reset-password")
        expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/sign-up")
        expect(screen.getByText("Ready when you are.")).toBeTruthy()
        expect(screen.getByRole("img", { name: "Ion, an Introify AI guide" })).toBeTruthy()
    })

    it("uses the shared persisted theme control in the account header", () => {
        localStorage.setItem("pl-theme", "light")
        render(<AuthFrame />)
        const theme = within(screen.getByRole("banner")).getByRole<HTMLSelectElement>("combobox", { name: "Color theme" })
        expect(theme.disabled).toBe(false)
        expect(theme.value).toBe("light")
        fireEvent.change(theme, { target: { value: "dark" } })
        expect(document.documentElement.classList.contains("dark")).toBe(true)
        expect(localStorage.getItem("pl-theme")).toBe("dark")
        expect(screen.getByRole("region", { name: "Sign in to Introify" })).toBeTruthy()
    })

    it("announces loading while the real account form is pending", () => {
        render(<AuthFrame><AuthLoading /></AuthFrame>)
        expect(screen.getByRole("status").textContent).toBe("Loading your account form…")
        expect(screen.queryByRole("textbox")).toBeNull()
        expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    })

    it("hydrates nested sign-up chrome and the real child step without mismatch", async () => {
        nav.pathname = "/sign-up/verify-email-address"
        localStorage.setItem("pl-theme", "dark")
        const frame = <AuthFrame><VerificationStep /></AuthFrame>
        const consoleError = vi.spyOn(console, "error")
        const container = document.createElement("div")
        container.innerHTML = renderToString(frame)
        document.body.appendChild(container)
        const serverTheme = within(container).getByRole<HTMLSelectElement>("combobox", { name: "Color theme" })
        expect(serverTheme.disabled).toBe(true)
        expect(serverTheme.value).toBe("system")

        const recoverableErrors: unknown[] = []
        let root: ReturnType<typeof hydrateRoot> | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, frame, { onRecoverableError: (error) => recoverableErrors.push(error) })
            })
            const content = within(container)
            expect(content.getByRole("region", { name: "Create your Introify account" })).toBeTruthy()
            expect(content.getByRole("heading", { name: "Check your email" })).toBeTruthy()
            expect(content.getByRole<HTMLSelectElement>("combobox", { name: "Color theme" }).value).toBe("dark")
            expect(recoverableErrors).toEqual([])
            expect(consoleError).not.toHaveBeenCalled()
        } finally {
            await act(async () => root?.unmount())
            container.remove()
        }
    })
})
