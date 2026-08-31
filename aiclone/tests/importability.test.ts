import { describe, expect, it } from "vitest"

/**
 * IMPORTABILITY GUARD.
 *
 * A component that cannot be imported cannot be tested, so this file pins the fact that all nine
 * modules in U4's ownership load under the runner. It exists because an inherited analysis claimed
 * "profile-view cannot be imported without a generated Prisma client" and used that as the reason
 * its lint error was untestable. That claim is FALSE under this runner - profile-view imports fine
 * (see the assertion below), so the error is testable and was treated as such.
 *
 * If a future dependency change makes one of these un-importable, this file fails loudly instead
 * of the relevant behaviour suite silently shrinking.
 */
const MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
    "auth/auth-look-swiper": () => import("@/components/auth/auth-look-swiper"),
    "booking/time-slot-picker": () => import("@/components/booking/time-slot-picker"),
    "chat/chat-interface": () => import("@/components/chat/chat-interface"),
    "dashboard/catalog-chrome": () => import("@/components/dashboard/catalog-chrome"),
    "dashboard/leads-studio": () => import("@/components/dashboard/leads-studio"),
    "dashboard/studio-pulse": () => import("@/components/dashboard/studio-pulse"),
    "profile/profile-view": () => import("@/components/profile/profile-view"),
    "profile/qr-card": () => import("@/components/profile/qr-card"),
    "app/[slug]/page": () => import("@/app/[slug]/page"),
}

describe("every component in U4's ownership imports under jsdom", () => {
    for (const [name, load] of Object.entries(MODULES)) {
        it(`imports ${name}`, async () => {
            const mod = await load()
            expect(Object.keys(mod).length).toBeGreaterThan(0)
        })
    }
})
