import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { useState } from "react"

/**
 * Toolchain smoke test. Proves, before any component test is trusted, that the runner really
 * compiles TSX, really mounts React 19 with a DOM, and really runs effects/state - i.e. that a
 * passing assertion in this suite means something.
 */
describe("test runner", () => {
    it("mounts a React 19 component into a real DOM", () => {
        function Counter() {
            const [n] = useState(41)
            return <p>count {n + 1}</p>
        }
        render(<Counter />)
        expect(screen.getByText("count 42")).toBeTruthy()
    })

    it("has a document and a window", () => {
        expect(typeof document.createElement).toBe("function")
        expect(typeof window.dispatchEvent).toBe("function")
    })

    it("does NOT provide matchMedia, so tests must install their own", () => {
        // Documented on purpose: several components under test are matchMedia-gated, and this
        // assertion pins the environment's baseline so a future global polyfill cannot quietly
        // change what those tests are proving.
        expect((window as unknown as { matchMedia?: unknown }).matchMedia).toBeUndefined()
    })
})
