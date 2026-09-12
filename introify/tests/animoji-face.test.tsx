import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { installMatchMedia } from "./helpers/match-media"
import { AnimojiFace } from "@/components/animoji-face"

describe("coded animoji faces", () => {
    it("draws one svg character per face, like LCD, never a smear strip", () => {
        installMatchMedia()
        for (const id of ["bounce", "sun", "et"] as const) {
            const { container, unmount } = render(<AnimojiFace id={id} size={64} />)
            expect(container.querySelector("svg")).toBeTruthy()
            expect(container.querySelector("img")).toBeNull()
            expect(container.querySelector("image")).toBeNull()
            expect(container.querySelector(".animoji-strip")).toBeNull()
            expect(container.querySelector("[data-animoji-coded='svg']")).toBeTruthy()
            expect(container.querySelector(`[data-animoji='${id}']`)).toBeTruthy()
            expect(container.querySelectorAll(".animoji-character")).toHaveLength(1)
            unmount()
        }

        const frozen = render(<AnimojiFace id="bounce" size={64} still />)
        expect(frozen.container.querySelector("[data-still='true']")).toBeTruthy()
        expect(frozen.container.querySelector(".animoji-character")).toBeTruthy()
        frozen.unmount()
    })
})
