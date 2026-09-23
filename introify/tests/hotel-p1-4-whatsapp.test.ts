import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    hotelNeedsExplicitHandoff,
    resolveGuestWhatsapp,
    HOTEL_SHARE_CHAT_RECEPTION_LABEL,
    HOTEL_SHARE_NO_WA_COPY,
} from "@/lib/hotels/guest-whatsapp"
import { TRY_HOTEL } from "@/lib/hotels/try-hotel-seed"
import { HAVEN_HOTEL } from "@/lib/demo-shops/stay"
import { isHotelRole } from "@/lib/hotels"

const root = process.cwd()

describe("HOTEL P1-4 — Haven WhatsApp / reception handoff sources", () => {
    it("Haven fixture exposes a real E.164 reception WhatsApp (demo number, not invented Twilio)", () => {
        expect(HAVEN_HOTEL.whatsapp).toBe("919431100221")
        expect(TRY_HOTEL.whatsapp).toBe(HAVEN_HOTEL.whatsapp)
        expect(TRY_HOTEL.whatsapp).toMatch(/^91\d{10}$/)
        expect(isHotelRole("HOTEL")).toBe(true)
    })

    it("resolveGuestWhatsapp prefers profile.whatsapp then receptionWhatsapp", () => {
        expect(resolveGuestWhatsapp("919431100221", "919900011122")).toBe("919431100221")
        expect(resolveGuestWhatsapp(null, "919431100221")).toBe("919431100221")
        expect(resolveGuestWhatsapp("+91 94311 00221", null)).toBe("919431100221")
        expect(resolveGuestWhatsapp(null, null)).toBeNull()
        expect(resolveGuestWhatsapp("", "  ")).toBeNull()
    })

    it("hotel needs explicit handoff when WA is unset — never silent-null", () => {
        expect(hotelNeedsExplicitHandoff({ isHotel: true, whatsapp: null })).toBe(true)
        expect(hotelNeedsExplicitHandoff({ isHotel: true, whatsapp: "" })).toBe(true)
        expect(hotelNeedsExplicitHandoff({ isHotel: true, whatsapp: "919431100221" })).toBe(false)
        expect(hotelNeedsExplicitHandoff({ isHotel: false, whatsapp: null })).toBe(false)
        expect(HOTEL_SHARE_NO_WA_COPY.toLowerCase()).toMatch(/whatsapp|chat reception|not configured/)
        expect(HOTEL_SHARE_CHAT_RECEPTION_LABEL).toMatch(/chat reception/i)
    })
})

describe("HOTEL P1-4 — seed + share/home wiring", () => {
    it("try-hotel seed creates and backfills Profile.whatsapp from Haven fixture", () => {
        const seed = readFileSync(join(root, "src/lib/hotels/try-hotel-seed.ts"), "utf8")
        expect(seed).toMatch(/whatsapp:\s*HAVEN_HOTEL\.whatsapp/)
        expect(seed).toMatch(/whatsapp:\s*TRY_HOTEL\.whatsapp/)
        expect(seed).toMatch(/receptionWhatsapp:\s*HAVEN_HOTEL\.whatsapp/)
        expect(seed).toMatch(/P1-4: keep Profile\.whatsapp/)
        expect(seed).toMatch(/data:\s*\{\s*whatsapp:\s*TRY_HOTEL\.whatsapp/)
    })

    it("share page resolves profile ‖ reception WhatsApp and marks hotel handoff", () => {
        const share = readFileSync(join(root, "src/app/[slug]/share/page.tsx"), "utf8")
        expect(share).toMatch(/resolveGuestWhatsapp/)
        expect(share).toMatch(/receptionWhatsapp/)
        expect(share).toMatch(/isHotelRole/)
        expect(share).toMatch(/isHotel=\{hotel\}/)
        expect(share).toMatch(/ensureTryHotelShowcase/)
        expect(share).toMatch(/isTryHotelShowcaseSlug/)
        // must not only pass raw profile.whatsapp
        expect(share).not.toMatch(/whatsapp=\{profile\.whatsapp\}/)
    })

    it("GuestSharePanel shows WA when configured, else explicit Chat reception for hotels", () => {
        const panel = readFileSync(join(root, "src/components/profile/guest-qr-share.tsx"), "utf8")
        expect(panel).toMatch(/isHotel/)
        expect(panel).toMatch(/HOTEL_SHARE_NO_WA_COPY/)
        expect(panel).toMatch(/HOTEL_SHARE_CHAT_RECEPTION_LABEL/)
        expect(panel).toMatch(/data-guest-share-whatsapp/)
        expect(panel).toMatch(/data-guest-share-chat-reception/)
        expect(panel).toMatch(/data-guest-share-no-wa/)
    })

    it("public home overlays receptionWhatsapp onto guest contact chrome", () => {
        const home = readFileSync(join(root, "src/app/[slug]/public-profile-screen.tsx"), "utf8")
        expect(home).toMatch(/resolveGuestWhatsapp/)
        expect(home).toMatch(/receptionWhatsapp/)
        expect(home).toMatch(/whatsapp:\s*guestWhatsapp/)
        expect(home).toMatch(/isHotelRole/)
    })

    it("hotels index re-exports guest WhatsApp helpers", () => {
        const index = readFileSync(join(root, "src/lib/hotels/index.ts"), "utf8")
        expect(index).toMatch(/resolveGuestWhatsapp/)
        expect(index).toMatch(/hotelNeedsExplicitHandoff/)
        expect(index).toMatch(/HOTEL_SHARE_NO_WA_COPY/)
        expect(index).toMatch(/from "\.\/guest-whatsapp"/)
    })
})
