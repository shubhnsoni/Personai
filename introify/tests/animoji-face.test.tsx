import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { installMatchMedia } from "./helpers/match-media"
import { AnimojiFace } from "@/components/animoji-face"

describe("coded animoji faces", () => {
    it("draws bounce, sun and et as svg instead of raster clips", () => {
        installMatchMedia()
        for (const id of ["bounce", "sun", "et"] as const) {
            const { container, unmount } = render(<AnimojiFace id={id} size={64} />)
            expect(container.querySelector("svg")).toBeTruthy()
            expect(container.querySelector("img")).toBeNull()
            expect(container.querySelector(`[data-animoji='${id}']`)).toBeTruthy()
            expect(container.querySelector("[data-animoji-coded='svg']")).toBeTruthy()
            unmount()
        }
    })
})
