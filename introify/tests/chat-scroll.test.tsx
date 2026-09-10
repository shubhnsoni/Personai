import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))
vi.mock("@/components/chat/chat-avatar", () => ({ ChatAvatar: () => <span aria-hidden /> }))

const { ChatInterface } = await import("@/components/chat/chat-interface")

const PROFILE = { id: "scroll-profile", slug: "custom", displayName: "Custom", roleTemplate: "RESTAURANT" }
const replies: Array<{ controller: ReadableStreamDefaultController<Uint8Array>; closed: boolean }> = []
const observers: ControlledResizeObserver[] = []

class ControlledResizeObserver {
    targets = new Set<Element>()
    disconnect = vi.fn(() => this.targets.clear())
    constructor(private callback: ResizeObserverCallback) { observers.push(this) }
    observe(target: Element) { this.targets.add(target) }
    unobserve(target: Element) { this.targets.delete(target) }
    notify() { this.callback([], this as unknown as ResizeObserver) }
}

beforeEach(() => {
    replies.length = 0
    observers.length = 0
    installMatchMedia({ [REDUCE_MOTION]: true })
    vi.stubGlobal("ResizeObserver", ControlledResizeObserver)
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) !== "/api/chat") return { ok: true, json: async () => ({}) }
        const body = new ReadableStream<Uint8Array>({
            start(controller) { replies.push({ controller, closed: false }) },
        })
        return new Response(body, { headers: { "X-Conversation-Id": "scroll-conversation" } })
    }))
})

afterEach(async () => {
    await act(async () => {
        for (const reply of replies) {
            if (!reply.closed) { reply.controller.close(); reply.closed = true }
        }
    })
    vi.unstubAllGlobals()
})

async function mountChat() {
    const view = render(<ChatInterface profile={PROFILE} animationConfig={{ theme: "retro-lcd" }} />)
    await act(async () => { await Promise.resolve() })
    const scrollport = screen.getByRole("region", { name: "Conversation" })
    // jsdom has no layout. Model a browser's clamped scroll offset so assertions cover
    // actual reading position instead of merely spying on a scroll method call.
    const dimensions = { content: 1400, viewport: 400, top: 0 }
    Object.defineProperties(scrollport, {
        scrollHeight: { configurable: true, get: () => dimensions.content },
        clientHeight: { configurable: true, get: () => dimensions.viewport },
        scrollTop: {
            configurable: true,
            get: () => dimensions.top,
            set: (value: number) => { dimensions.top = Math.max(0, Math.min(value, dimensions.content - dimensions.viewport)) },
        },
    })
    return { ...view, scrollport, dimensions }
}

async function send(text = "Hello") {
    const input = screen.getByPlaceholderText("Tell me more about...")
    fireEvent.change(input, { target: { value: text } })
    await act(async () => { fireEvent.submit(input.closest("form")!) })
}

async function chunk(text: string, index = replies.length - 1) {
    await act(async () => {
        replies[index].controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(text)}\n`))
    })
}

async function finish(index = replies.length - 1) {
    await act(async () => {
        replies[index].controller.close()
        replies[index].closed = true
    })
}

function readAt(scrollport: HTMLElement, top: number) {
    scrollport.scrollTop = top
    fireEvent.scroll(scrollport)
}

describe("Chat transcript scroll following", () => {
    it("keeps earlier messages in place while later response chunks stream and finish", async () => {
        const { scrollport, dimensions } = await mountChat()
        await send()
        expect(scrollport.scrollTop).toBe(1000)
        dimensions.content = 1700
        await chunk("First part. ")
        expect(scrollport.scrollTop).toBe(1300)

        readAt(scrollport, 220)
        expect(screen.getByRole("button", { name: "Latest messages" })).toBeTruthy()
        dimensions.content = 2100
        await chunk("Second part.")
        expect(screen.getByText("First part. Second part.")).toBeTruthy()
        expect(scrollport.scrollTop).toBe(220)
        await finish()
        expect(scrollport.scrollTop).toBe(220)
    })

    it("resumes following when the reader scrolls back near the newest message", async () => {
        const { scrollport, dimensions } = await mountChat()
        await send()
        readAt(scrollport, 200)
        dimensions.content = 1900
        await chunk("Read at your pace. ")
        readAt(scrollport, 1430)
        expect(screen.queryByRole("button", { name: "Latest messages" })).toBeNull()

        dimensions.content = 2250
        await chunk("Here is more.")
        expect(scrollport.scrollTop).toBe(1850)
    })

    it("moves to the latest message on explicit send after reading old messages", async () => {
        const { scrollport, dimensions } = await mountChat()
        await send()
        await chunk("First answer.")
        await finish()
        readAt(scrollport, 100)

        dimensions.content = 2400
        await send("One more question")
        expect(scrollport.scrollTop).toBe(2000)
        expect(screen.queryByRole("button", { name: "Latest messages" })).toBeNull()
        dimensions.content = 2600
        await chunk("Second answer.")
        expect(scrollport.scrollTop).toBe(2200)
    })

    it("lets Latest messages jump to the bottom and follow subsequent chunks", async () => {
        const { scrollport, dimensions } = await mountChat()
        await send()
        readAt(scrollport, 150)
        dimensions.content = 2000
        await chunk("More detail. ")
        fireEvent.click(screen.getByRole("button", { name: "Latest messages" }))
        expect(scrollport.scrollTop).toBe(1600)
        expect(screen.queryByRole("button", { name: "Latest messages" })).toBeNull()

        dimensions.content = 2300
        await chunk("And the next detail.")
        expect(scrollport.scrollTop).toBe(1900)
    })

    it("follows viewport/content resizing only while following and disconnects on unmount", async () => {
        const { scrollport, dimensions, unmount } = await mountChat()
        await send()
        const observer = observers.find(item => item.targets.has(scrollport))!
        expect(observer.targets.has(scrollport.firstElementChild!)).toBe(true)
        dimensions.viewport = 250
        act(() => observer.notify())
        expect(scrollport.scrollTop).toBe(1150)

        readAt(scrollport, 300)
        dimensions.viewport = 200
        dimensions.content = 1900
        act(() => observer.notify())
        expect(scrollport.scrollTop).toBe(300)

        fireEvent.click(screen.getByRole("button", { name: "Latest messages" }))
        dimensions.viewport = 400
        act(() => observer.notify())
        expect(scrollport.scrollTop).toBe(1500)
        await finish()
        unmount()
        expect(observer.disconnect).toHaveBeenCalledOnce()
    })
})
