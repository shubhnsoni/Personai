import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Chip } from "@/components/ui/chip"

describe("Small chip label contrast", () => {
    it.each([
        { variant: "profile" as const, highlighted: true, foreground: "text-brand-foreground" },
        { variant: "profile" as const, highlighted: false, foreground: "text-profile-text" },
        { variant: "default" as const, highlighted: false, foreground: "text-foreground" },
    ])("preserves $foreground for $variant with highlighted=$highlighted", ({ variant, highlighted, foreground }) => {
        render(<Chip label="About" size="sm" variant={variant} highlighted={highlighted} />)
        const chip = screen.getByRole("button", { name: "About" })
        // These must survive the final cn/tailwind-merge pass together. A custom
        // text-micro size was previously mistaken for a color and erased contrast.
        expect(chip.classList.contains(foreground)).toBe(true)
        expect(chip.classList.contains("text-xs")).toBe(true)
        expect(chip.classList.contains("tracking-[0.02em]")).toBe(true)
    })
})
