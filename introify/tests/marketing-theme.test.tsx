import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/marketing/theme-toggle"

const STORAGE_KEY = "pl-theme"

function systemPreference(initialDark = false) {
    let dark = initialDark
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const query = {
        media: "(prefers-color-scheme: dark)",
        get matches() { return dark },
        onchange: null,
        addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
        removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
        dispatchEvent: () => true,
    } as MediaQueryList
    vi.stubGlobal("matchMedia", vi.fn(() => query))
    return {
        setDark(next: boolean) {
            dark = next
            const event = { matches: dark, media: query.media } as MediaQueryListEvent
            for (const listener of [...listeners]) listener.call(query, event)
        },
    }
}

function ThemeControl() {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={STORAGE_KEY}>
            <ThemeToggle />
        </ThemeProvider>
    )
}

function selectTheme(value: "light" | "dark" | "system") {
    fireEvent.change(screen.getByRole("combobox", { name: "Color theme" }), { target: { value } })
}

function expectAppliedTheme(theme: "light" | "dark") {
    expect(document.documentElement.classList.contains(theme)).toBe(true)
    expect(document.documentElement.classList.contains(theme === "dark" ? "light" : "dark")).toBe(false)
}

beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.removeProperty("color-scheme")
})

afterEach(() => {
    cleanup()
    localStorage.removeItem(STORAGE_KEY)
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.removeProperty("color-scheme")
})

describe("marketing color theme", () => {
    it("applies and saves explicit Light/Dark choices without following later system changes", () => {
        const system = systemPreference(false)
        render(<ThemeControl />)
        expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Color theme" }).disabled).toBe(false)
        expect(screen.getAllByRole<HTMLOptionElement>("option").map((option) => [option.textContent, option.value])).toEqual([
            ["Light", "light"], ["Dark", "dark"], ["System", "system"],
        ])

        selectTheme("dark")
        expectAppliedTheme("dark")
        expect(localStorage.getItem(STORAGE_KEY)).toBe("dark")
        act(() => system.setDark(true))
        act(() => system.setDark(false))
        expectAppliedTheme("dark")

        selectTheme("light")
        expectAppliedTheme("light")
        expect(localStorage.getItem(STORAGE_KEY)).toBe("light")
        act(() => system.setDark(true))
        expectAppliedTheme("light")
        expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Color theme" }).value).toBe("light")
    })

    it("tracks OS changes in System mode while preserving System as the saved choice", () => {
        localStorage.setItem(STORAGE_KEY, "dark")
        const system = systemPreference(false)
        render(<ThemeControl />)
        selectTheme("system")
        expectAppliedTheme("light")
        expect(localStorage.getItem(STORAGE_KEY)).toBe("system")

        act(() => system.setDark(true))
        expectAppliedTheme("dark")
        act(() => system.setDark(false))
        expectAppliedTheme("light")
        expect(localStorage.getItem(STORAGE_KEY)).toBe("system")
        expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Color theme" }).value).toBe("system")
    })

    it("restores the saved choice after the provider remounts, even when the OS prefers another theme", () => {
        systemPreference(false)
        const first = render(<ThemeControl />)
        selectTheme("dark")
        first.unmount()
        document.documentElement.classList.remove("light", "dark")

        render(<ThemeControl />)
        expectAppliedTheme("dark")
        expect(localStorage.getItem(STORAGE_KEY)).toBe("dark")
        expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Color theme" }).value).toBe("dark")
    })

    it("renders a neutral disabled control on the server and hydrates to the saved choice without mismatch", async () => {
        localStorage.setItem(STORAGE_KEY, "dark")
        systemPreference(false)
        const consoleError = vi.spyOn(console, "error")
        const container = document.createElement("div")
        container.innerHTML = renderToString(<ThemeControl />)
        document.body.appendChild(container)
        const serverControl = within(container).getByRole<HTMLSelectElement>("combobox", { name: "Color theme" })
        expect(serverControl.disabled).toBe(true)
        expect(serverControl.value).toBe("system")

        const recoverableErrors: unknown[] = []
        let root: ReturnType<typeof hydrateRoot> | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, <ThemeControl />, { onRecoverableError: (error) => recoverableErrors.push(error) })
            })
            const clientControl = within(container).getByRole<HTMLSelectElement>("combobox", { name: "Color theme" })
            expect(clientControl.disabled).toBe(false)
            expect(clientControl.value).toBe("dark")
            expectAppliedTheme("dark")
            expect(recoverableErrors).toEqual([])
            expect(consoleError).not.toHaveBeenCalled()
        } finally {
            await act(async () => root?.unmount())
            container.remove()
        }
    })
})
