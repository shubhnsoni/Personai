import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { ChatAvatar } from "@/components/chat/chat-avatar"

describe("ChatAvatar photo", () => {
    it("crops a business photo into a filled circle instead of the original rectangle", () => {
        const { container } = render(
            <ChatAvatar
                size={36}
                name="SkyDine Cafe"
                imageUrl="/uploads/skydine-cafe/logo.png"
                mode="IMAGE"
            />,
        )
        const wrap = container.querySelector("[data-chat-avatar='photo']") as HTMLElement
        const img = wrap.querySelector("img") as HTMLImageElement
        expect(wrap).toBeTruthy()
        expect(wrap.style.borderRadius).toBe("9999px")
        expect(wrap.style.overflow).toBe("hidden")
        expect(wrap.style.width).toBe("36px")
        expect(wrap.style.height).toBe("36px")
        expect(img.style.objectFit).toBe("cover")
        expect(img.getAttribute("alt")).toBe("SkyDine Cafe")
    })
})
