import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { cloneElement, createRef, isValidElement, type AnchorHTMLAttributes, type ComponentProps, type MouseEvent, type ReactNode, type Ref } from "react"

const navigation = vi.hoisted(() => ({ pathname: "/before", navigate: vi.fn(), passed: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }))
vi.mock("next/link", () => {
    type Url = string | { pathname?: string; query?: Record<string, string>; hash?: string }
    type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
        href: Url; as?: Url; prefetch?: boolean | null; replace?: boolean; scroll?: boolean; shallow?: boolean;
        onNavigate?: (event: { preventDefault: () => void }) => void; ref?: Ref<HTMLAnchorElement>;
    }
    const format = (url: Url): string => typeof url === "string" ? url : `${url.pathname || window.location.pathname}${url.query ? `?${new URLSearchParams(url.query)}` : ""}${url.hash ? `#${url.hash.replace(/^#/, "")}` : ""}`
    function NextLinkMock({ href, as, onNavigate, onClick, prefetch, replace, scroll, shallow, ref, ...props }: Props) {
        const shown = format(as ?? href)
        navigation.passed({ href, as, prefetch, replace, scroll, shallow })
        return <a {...props} href={shown} ref={ref} onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(event)
            const callerCancelled = event.defaultPrevented
            // Follow the installed Next link's onNavigate contract. The mock does
            // no routing: tests explicitly commit usePathname to expose races.
            const native = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
                || (props.target && props.target !== "_self") || props.download !== undefined
                || new URL(shown, window.location.href).origin !== window.location.origin
            event.preventDefault() // Keep jsdom from attempting native navigation.
            if (callerCancelled || native) return
            let cancelled = false
            onNavigate?.({ preventDefault: () => { cancelled = true } })
            if (!cancelled) navigation.navigate(shown, { replace, scroll })
        }} />
    }
    return { default: NextLinkMock }
})

import { PageTransitionProvider } from "@/components/navigation/page-transition"
import TransitionLink from "@/components/navigation/transition-link"
import { BrandLoading } from "@/components/navigation/brand-loading"

type LinkProps = ComponentProps<typeof TransitionLink>
const animate = vi.fn()
function Fixture({ links = [{ href: "/next", children: "Next page" }], extra }: { links?: LinkProps[]; extra?: ReactNode }) {
    return <PageTransitionProvider><main ref={element => { if (element) element.animate = animate }}><button type="button">Keep focus</button>{links.map((props, index) => <TransitionLink key={index} {...props} />)}{extra}</main></PageTransitionProvider>
}
function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms) }) }
function commit(path: string, rerender: ReturnType<typeof render>["rerender"], fixture: ReactNode = <Fixture />) {
    navigation.pathname = path
    window.history.replaceState({}, "", path)
    rerender(isValidElement(fixture) ? cloneElement(fixture) : fixture)
}
function phase() { return screen.queryByRole("status")?.getAttribute("data-phase") }

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] })
    vi.clearAllMocks()
    navigation.pathname = "/before"
    window.history.replaceState({}, "", "/before")
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })))
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id))
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe("inter-page transition lifecycle", () => {
    it("keeps first render clear and begins decoration without delaying navigation or moving focus", () => {
        render(<Fixture />)
        expect(screen.queryByRole("status")).toBeNull()
        const focus = screen.getByRole("button", { name: "Keep focus" })
        focus.focus()
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        expect(navigation.navigate).toHaveBeenCalledOnce()
        expect(phase()).toBe("opening")
        expect(document.activeElement).toBe(focus)
        expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite")
        expect(screen.getByText("Loading page")).toBeTruthy()
        expect(screen.getByRole("status").querySelector(".brand-loading-visual")?.getAttribute("aria-hidden")).toBe("true")
        expect(screen.queryByRole("dialog")).toBeNull()
    })
    it("finishes after the route commits, using only the short visual exit", () => {
        const { rerender } = render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        commit("/next", rerender)
        advance(16)
        expect(animate).toHaveBeenCalledWith([{ opacity: 0.88 }, { opacity: 1 }], { duration: 320, easing: "ease-out" })
        advance(263)
        expect(phase()).toBe("opening")
        advance(1)
        expect(phase()).toBe("leaving")
        advance(320)
        expect(screen.queryByRole("status")).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })
    it.each(["/before", "/before#section", "/before?filter=one", "#section", "?filter=one", { pathname: "/before", query: { filter: "one" }, hash: "section" }, { query: { filter: "one" } }])("does not decorate same-path/hash/query navigation %#", href => {
        render(<Fixture links={[{ href, children: "Same page" }]} />)
        fireEvent.click(screen.getByRole("link", { name: "Same page" }))
        expect(navigation.navigate).toHaveBeenCalledOnce()
        expect(screen.queryByRole("status")).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })
    it("respects caller-cancelled onNavigate", () => {
        const cancel = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
        render(<Fixture links={[{ href: "/next", children: "Ask first", onNavigate: cancel }]} />)
        fireEvent.click(screen.getByRole("link", { name: "Ask first" }))
        expect(cancel).toHaveBeenCalledOnce()
        expect(navigation.navigate).not.toHaveBeenCalled()
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("respects caller-cancelled onClick before Next invokes onNavigate", () => {
        const onNavigate = vi.fn()
        render(<Fixture links={[{ href: "/next", children: "Ask first", onClick: event => event.preventDefault(), onNavigate }]} />)
        fireEvent.click(screen.getByRole("link", { name: "Ask first" }))
        expect(onNavigate).not.toHaveBeenCalled()
        expect(navigation.navigate).not.toHaveBeenCalled()
        expect(screen.queryByRole("status")).toBeNull()
    })
    it.each([{ target: "_blank" }, { download: "file.txt" }, { href: "https://other.example.test/next" }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])("preserves Next native-link exclusions %#", variant => {
        const { ctrlKey, metaKey, shiftKey, altKey, button, ...props } = variant as { target?: string; download?: string; href?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }
        render(<Fixture links={[{ href: "/next", children: "Native link", ...props }]} />)
        fireEvent.click(screen.getByRole("link", { name: "Native link" }), { ctrlKey, metaKey, shiftKey, altKey, button: button ?? 0 })
        expect(navigation.navigate).not.toHaveBeenCalled()
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("forwards refs and Next route options and uses the displayed as-path", () => {
        const ref = createRef<HTMLAnchorElement>()
        const links: LinkProps[] = [{ href: "/internal", as: "/public-next?sort=recent#top", children: "Displayed route", ref, prefetch: false, replace: true, scroll: false }]
        const { rerender } = render(<Fixture links={links} />)
        expect(ref.current).toBe(screen.getByRole("link", { name: "Displayed route" }))
        fireEvent.click(ref.current!)
        expect(navigation.passed).toHaveBeenCalledWith(expect.objectContaining({ href: "/internal", as: "/public-next?sort=recent#top", prefetch: false, replace: true, scroll: false }))
        expect(navigation.navigate).toHaveBeenCalledWith("/public-next?sort=recent#top", { replace: true, scroll: false })
        commit("/public-next", rerender, <Fixture links={links} />)
        advance(650)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("does not let a superseded route commit dismiss the latest navigation", () => {
        const links: LinkProps[] = [{ href: "/first", children: "First" }, { href: "/second", children: "Second" }]
        const fixture = <Fixture links={links} />
        const { rerender } = render(fixture)
        fireEvent.click(screen.getByRole("link", { name: "First" }))
        advance(50)
        fireEvent.click(screen.getByRole("link", { name: "Second" }))
        commit("/first", rerender, fixture)
        advance(1000)
        expect(phase()).toBe("opening")
        commit("/second", rerender, fixture)
        advance(400)
        expect(screen.queryByRole("status")).toBeNull()
        expect(navigation.navigate).toHaveBeenCalledTimes(2)
    })
    it("cancels an older exit timer when navigation restarts", () => {
        const links: LinkProps[] = [{ href: "/first", children: "First" }, { href: "/second", children: "Second" }]
        const fixture = <Fixture links={links} />
        const { rerender } = render(fixture)
        fireEvent.click(screen.getByRole("link", { name: "First" }))
        commit("/first", rerender, fixture)
        advance(300)
        expect(phase()).toBe("leaving")
        fireEvent.click(screen.getByRole("link", { name: "Second" }))
        advance(400)
        expect(phase()).toBe("opening")
        commit("/second", rerender, fixture)
        advance(400)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("allows a new selection of a previously superseded destination to complete", () => {
        const links: LinkProps[] = [{ href: "/first", children: "First" }, { href: "/second", children: "Second" }]
        const fixture = <Fixture links={links} />
        const { rerender } = render(fixture)
        fireEvent.click(screen.getByRole("link", { name: "First" }))
        fireEvent.click(screen.getByRole("link", { name: "Second" }))
        fireEvent.click(screen.getByRole("link", { name: "First" }))
        commit("/first", rerender, fixture)
        advance(650)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("finishes a redirected route without waiting for the recovery timeout", () => {
        const { rerender } = render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        commit("/sign-in", rerender)
        advance(650)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("clears a pending transition when the visitor chooses the already-current page", () => {
        render(<Fixture links={[{ href: "/next", children: "Next" }, { href: "/before#local", children: "Stay here" }]} />)
        fireEvent.click(screen.getByRole("link", { name: "Next" }))
        advance(100)
        fireEvent.click(screen.getByRole("link", { name: "Stay here" }))
        advance(501)
        expect(screen.queryByRole("status")).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })
    it("recovers from an uncommitted or cancelled navigation within the bounded timeout", () => {
        render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        advance(7999)
        expect(phase()).toBe("opening")
        advance(2)
        expect(phase()).toBe("leaving")
        advance(320)
        expect(screen.queryByRole("status")).toBeNull()
        expect(vi.getTimerCount()).toBe(0)
    })
    it.each([true, undefined])("uses a static short exit with reduced-motion/unknown preference %s", preference => {
        vi.stubGlobal("matchMedia", preference === undefined ? undefined : vi.fn(() => ({ matches: preference })))
        const { rerender } = render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        commit("/next", rerender)
        advance(20)
        expect(screen.queryByRole("status")).toBeNull()
        expect(animate).not.toHaveBeenCalled()
    })
    it("finishes stale presentation when the browser restores the page", () => {
        render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        fireEvent(window, new Event("pageshow"))
        advance(650)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("decorates cross-path browser history and finishes when its pathname commits", () => {
        const { rerender } = render(<Fixture />)
        window.history.replaceState({}, "", "/history-page")
        fireEvent(window, new PopStateEvent("popstate"))
        expect(phase()).toBe("opening")
        navigation.pathname = "/history-page"
        rerender(<Fixture />)
        advance(650)
        expect(screen.queryByRole("status")).toBeNull()
    })
    it("cleans recovery, exit timers and pending route frames on unmount", () => {
        const { rerender, unmount } = render(<Fixture />)
        fireEvent.click(screen.getByRole("link", { name: "Next page" }))
        commit("/next", rerender)
        expect(vi.getTimerCount()).toBeGreaterThan(0)
        unmount()
        expect(vi.getTimerCount()).toBe(0)
        fireEvent(window, new PopStateEvent("popstate"))
        fireEvent(window, new Event("pageshow"))
        expect(vi.getTimerCount()).toBe(0)
        expect(animate).not.toHaveBeenCalled()
    })
    it("keeps standalone loading states labeled with decorative artwork hidden", () => {
        render(<BrandLoading label="Loading your workspace" compact />)
        const status = screen.getByRole("status")
        expect(status.getAttribute("aria-live")).toBe("polite")
        expect(screen.getByText("Loading your workspace")).toBeTruthy()
        expect(status.querySelector(".brand-loading-visual")?.getAttribute("aria-hidden")).toBe("true")
    })
})
