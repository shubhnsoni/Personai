import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"

const state = vi.hoisted(() => ({ pathname: "/custom", resolvedTheme: "light" as string | undefined, forcedTheme: undefined as string | undefined }))
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: state.resolvedTheme, forcedTheme: state.forcedTheme }) }))
const { PublicBusinessFrame } = await import("@/components/profile/public-business-frame")

const defaultMeta: HTMLMetaElement[] = []
const root = () => document.documentElement
const chromeMeta = () => document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

function contents(theme = "retro-lcd") {
    return (
        <PublicBusinessFrame profilePath="/custom" theme={theme}>
            <main>Conversation</main>
            <footer>Made with Introify</footer>
        </PublicBusinessFrame>
    )
}

beforeEach(() => {
    state.pathname = "/custom"
    state.resolvedTheme = "light"
    state.forcedTheme = undefined
    root().className = ""
    root().style.cssText = "background-color: rgb(8, 18, 35); color-scheme: light;"
    document.body.style.cssText = "background-color: rgb(9, 19, 36) !important; color-scheme: light dark; overflow-y: auto;"
    for (const [mode, color] of [["light", "#ffffff"], ["dark", "#050505"]]) {
        const meta = document.createElement("meta")
        meta.name = "theme-color"
        meta.media = `(prefers-color-scheme: ${mode})`
        meta.content = color
        document.head.append(meta)
        defaultMeta.push(meta)
    }
})

afterEach(() => {
    cleanup()
    defaultMeta.splice(0).forEach(meta => meta.remove())
    root().style.cssText = ""
    root().className = ""
    document.body.style.cssText = ""
})

describe("Public business browser chrome", () => {
    it.each([
        {
            theme: "cosmic-space",
            light: "#f3edfc",
            lightRgb: "rgb(243, 237, 252)",
            dark: "#0b0818",
            darkRgb: "rgb(11, 8, 24)",
        },
        {
            theme: "cosmic-comic",
            light: "#f5e7c9",
            lightRgb: "rgb(245, 231, 201)",
            dark: "#181020",
            darkRgb: "rgb(24, 16, 32)",
        },
        {
            theme: "holographic-hud",
            light: "#eef6fc",
            lightRgb: "rgb(238, 246, 252)",
            dark: "#091525",
            darkRgb: "rgb(9, 21, 37)",
        },
    ])("keeps $theme canvas and browser metadata in sync through mode and route changes", ({ theme, light, lightRgb, dark, darkRgb }) => {
        const { container, rerender } = render(contents(theme))
        const frame = container.firstElementChild as HTMLElement
        expect(frame.getAttribute("data-public-business-theme")).toBe(theme)
        expect(frame.getAttribute("data-public-browser-theme")).toBe(theme)
        expect(frame.hasAttribute("data-profile-viewport")).toBe(true)
        expect(chromeMeta()?.content).toBe(light)
        expect(chromeMeta()?.hasAttribute("media")).toBe(false)
        expect(root().style.backgroundColor).toBe(lightRgb)
        expect(document.body.style.backgroundColor).toBe(lightRgb)

        state.resolvedTheme = "dark"
        root().classList.add("dark")
        root().style.colorScheme = "dark"
        rerender(contents(theme))
        expect(chromeMeta()?.content).toBe(dark)
        expect(root().style.backgroundColor).toBe(darkRgb)
        expect(document.body.style.backgroundColor).toBe(darkRgb)
        expect(document.body.style.colorScheme).toBe("dark")
        expect(document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.content).toBe("dark")
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(2)

        state.pathname = "/custom/shop/product-one"
        rerender(contents(theme))
        expect(frame.hasAttribute("data-profile-viewport")).toBe(false)
        expect(frame.getAttribute("data-public-browser-theme")).toBe(theme)
        expect(chromeMeta()?.content).toBe(dark)
        expect(document.body.style.overflowY).toBe("auto")

        state.resolvedTheme = "light"
        root().classList.remove("dark")
        root().style.colorScheme = "light"
        rerender(contents(theme))
        expect(chromeMeta()?.content).toBe(light)
        expect(document.body.style.backgroundColor).toBe(lightRgb)
        expect(document.body.style.colorScheme).toBe("light")
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(2)

        state.pathname = "/dashboard"
        rerender(contents(theme))
        expect(frame.hasAttribute("data-public-browser-theme")).toBe(false)
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(0)
        expect(chromeMeta()).toBe(defaultMeta[0])
        expect(root().style.backgroundColor).toBe("rgb(8, 18, 35)")
        expect(document.body.style.backgroundColor).toBe("rgb(9, 19, 36)")
        expect(document.body.style.getPropertyPriority("background-color")).toBe("important")
        expect(document.body.style.colorScheme).toBe("light dark")
        expect(root().style.colorScheme).toBe("light")
        expect(defaultMeta.map(meta => meta.content)).toEqual(["#ffffff", "#050505"])
    })

    it("replaces Nova and Hologram browser metadata when the saved bot theme changes", () => {
        state.resolvedTheme = "dark"
        root().classList.add("dark")
        const { container, rerender, unmount } = render(contents("cosmic-space"))
        const frame = container.firstElementChild as HTMLElement
        for (const [theme, canvas] of [
            ["cosmic-space", "#0b0818"],
            ["cosmic-comic", "#181020"],
            ["holographic-hud", "#091525"],
            ["cosmic-space", "#0b0818"],
        ]) {
            rerender(contents(theme))
            expect(frame.getAttribute("data-public-browser-theme")).toBe(theme)
            expect(chromeMeta()?.content).toBe(canvas)
            expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(2)
        }
        unmount()
        expect(chromeMeta()).toBe(defaultMeta[0])
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(0)
        expect(root().style.backgroundColor).toBe("rgb(8, 18, 35)")
        expect(document.body.style.backgroundColor).toBe("rgb(9, 19, 36)")
    })

    it("paints html and the profile viewport so no default strip shows around the canvas", () => {
        const { container, rerender } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        expect(frame.className).toMatch(/\bh-dvh\b/)
        expect(frame.getAttribute("data-profile-viewport")).toBe("")

        state.pathname = "/custom/shop"
        rerender(contents("astral-nebula"))
        expect(frame.getAttribute("data-public-browser-theme")).toBe("astral-nebula")
        expect(chromeMeta()?.content).toBe("#ede6fb")

        state.pathname = "/custom"
        state.resolvedTheme = "dark"
        root().classList.add("dark")
        rerender(contents("classic"))
        expect(frame.getAttribute("data-public-browser-theme")).toBe("classic")
        expect(chromeMeta()?.content).toBeTruthy()
        expect(document.body.style.backgroundColor).not.toBe("")
    })

    it("uses the selected light mode rather than the operating system's dark appearance", () => {
        // The root theme metadata still has both OS queries; the active app choice wins.
        const { unmount } = render(contents())
        expect(chromeMeta()?.content).toBe("#c4d58a")
        expect(chromeMeta()?.hasAttribute("media")).toBe(false)
        expect(root().style.backgroundColor).toBe("rgb(196, 213, 138)")
        expect(document.body.style.backgroundColor).toBe("rgb(196, 213, 138)")
        expect(document.body.style.colorScheme).toBe("light")
        expect(document.head.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.content).toBe("light")
        expect(defaultMeta.map(meta => meta.content)).toEqual(["#ffffff", "#050505"])
        unmount()
    })

    it("updates to near-black dark mode immediately and does not accumulate metadata tags", () => {
        const { rerender, unmount } = render(contents())
        state.resolvedTheme = "dark"
        root().classList.add("dark")
        // This property belongs to next-themes and must not be restored to an old mode later.
        root().style.colorScheme = "dark"
        rerender(contents())
        expect(chromeMeta()?.content).toBe("#10170f")
        expect(root().style.backgroundColor).toBe("rgb(16, 23, 15)")
        expect(document.body.style.backgroundColor).toBe("rgb(16, 23, 15)")
        expect(document.body.style.colorScheme).toBe("dark")
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(2)
        unmount()
        expect(root().style.colorScheme).toBe("dark")
        expect(root().classList.contains("dark")).toBe(true)
    })

    it("keeps the palette across catalogues then restores styles and root metadata on leaving", () => {
        const { container, rerender } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        state.pathname = "/custom/shop/product-one"
        rerender(contents())
        expect(frame.hasAttribute("data-profile-viewport")).toBe(false)
        expect(frame.getAttribute("data-public-browser-theme")).toBe("retro-lcd")
        expect(chromeMeta()?.content).toBe("#c4d58a")
        expect(document.body.style.overflowY).toBe("auto")
        expect(frame.style.height).toBe("")

        state.pathname = "/dashboard"
        rerender(contents())
        expect(frame.hasAttribute("data-public-browser-theme")).toBe(false)
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(0)
        expect(chromeMeta()).toBe(defaultMeta[0])
        expect(root().style.backgroundColor).toBe("rgb(8, 18, 35)")
        expect(document.body.style.backgroundColor).toBe("rgb(9, 19, 36)")
        expect(document.body.style.getPropertyPriority("background-color")).toBe("important")
        expect(document.body.style.colorScheme).toBe("light dark")
        expect(document.body.style.overflowY).toBe("auto")
    })

    it("uses the early root mode before next-themes resolves and respects a forced mode", () => {
        state.resolvedTheme = undefined
        root().classList.add("dark")
        const { rerender } = render(contents())
        expect(chromeMeta()?.content).toBe("#10170f")
        state.forcedTheme = "light"
        state.resolvedTheme = "dark"
        rerender(contents())
        expect(chromeMeta()?.content).toBe("#c4d58a")
        expect(document.body.style.colorScheme).toBe("light")
    })

    it("does not overwrite a newer page's background or metadata during cleanup", () => {
        const { unmount } = render(contents())
        root().style.backgroundColor = "rgb(22, 33, 44)"
        document.body.style.backgroundColor = "rgb(55, 66, 77)"
        defaultMeta[0].content = "#123456"
        unmount()
        expect(root().style.backgroundColor).toBe("rgb(22, 33, 44)")
        expect(document.body.style.backgroundColor).toBe("rgb(55, 66, 77)")
        expect(chromeMeta()?.content).toBe("#123456")
        expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(0)
    })

    it("re-reads Classic CSS after next-themes applies its root class later in the commit", async () => {
        const stylesheet = document.createElement("style")
        stylesheet.textContent = `
            [data-public-business-theme="classic"] { --profile-bg: oklch(0.97 0.008 240); }
            .dark [data-public-business-theme="classic"] { --profile-bg: oklch(0.08 0.02 250); }
        `
        document.head.append(stylesheet)
        try {
            // The context is dark already, but the provider has not committed its root class yet.
            state.resolvedTheme = "dark"
            const { rerender, unmount } = render(contents("classic"))
            expect(chromeMeta()?.content).toBe("oklch(0.97 0.008 240)")
            await act(async () => { root().classList.add("dark") })
            expect(chromeMeta()?.content).toBe("oklch(0.08 0.02 250)")
            expect(document.body.style.backgroundColor).toBe("oklch(0.08 0.02 250)")
            expect(root().style.backgroundColor).toBe("oklch(0.08 0.02 250)")

            state.resolvedTheme = "light"
            rerender(contents("classic"))
            await act(async () => { root().classList.remove("dark") })
            expect(chromeMeta()?.content).toBe("oklch(0.97 0.008 240)")
            expect(document.body.style.backgroundColor).toBe("oklch(0.97 0.008 240)")
            expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(2)

            unmount()
            await act(async () => { root().classList.add("dark") })
            expect(chromeMeta()).toBe(defaultMeta[0])
            expect(document.body.style.backgroundColor).toBe("rgb(9, 19, 36)")
            expect(document.body.style.getPropertyPriority("background-color")).toBe("important")
            expect(document.head.querySelectorAll("meta[data-public-browser-theme]")).toHaveLength(0)
        } finally {
            stylesheet.remove()
        }
    })
})
