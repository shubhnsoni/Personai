import { describe, expect, it } from "vitest"
import { isReservedSlug } from "@/lib/slugs"
import { usernameError } from "@/lib/username"
import {
    DEFAULT_UI_LOCALE,
    RESERVED_UI_LOCALES,
    SHIPPED_UI_LOCALES,
    homeHash,
    htmlLang,
    isLocaleHomeSlug,
    isReservedUiLocale,
    isShippedUiLocale,
    localeFromPathname,
    localeHomePath,
    localeSwitchPath,
    parseUiLocale,
    resolveRequestUiLocale,
    sanitizeAppPath,
} from "@/lib/ui-locale"

describe("UI locale kernel", () => {
    it("ships English and Hindi and reserves later Indic codes", () => {
        expect([...SHIPPED_UI_LOCALES]).toEqual(["en", "hi"])
        expect(RESERVED_UI_LOCALES).toEqual(["en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "ml", "pa"])
        for (const code of RESERVED_UI_LOCALES) {
            expect(isReservedUiLocale(code)).toBe(true)
            expect(isReservedSlug(code)).toBe(true)
            expect(isIndexableBlocked(code)).toBe(true)
        }
        expect(isShippedUiLocale("bn")).toBe(false)
        expect(isLocaleHomeSlug("hi")).toBe(true)
        expect(isLocaleHomeSlug("en")).toBe(false)
        expect(isLocaleHomeSlug("bn")).toBe(false)
    })

    it("keeps / as English and /hi as Hindi without reading the cookie on those paths", () => {
        expect(resolveRequestUiLocale("/", "hi")).toBe("en")
        expect(resolveRequestUiLocale("/hi", "en")).toBe("hi")
        expect(resolveRequestUiLocale("/hi/", null)).toBe("hi")
        expect(resolveRequestUiLocale("/pricing", "hi")).toBe("hi")
        expect(resolveRequestUiLocale("/pricing", "bn")).toBe(DEFAULT_UI_LOCALE)
        expect(resolveRequestUiLocale("/pricing")).toBe("en")
        expect(resolveRequestUiLocale("/hi/shop", "hi")).toBe("hi")
        expect(localeFromPathname("/hi/shop")).toBeNull()
        expect(localeFromPathname("/en")).toBeNull()
    })

    it("maps html lang and homepage paths to the Search-friendly pair", () => {
        expect(htmlLang("en")).toBe("en")
        expect(htmlLang("hi")).toBe("hi-IN")
        expect(localeHomePath("en")).toBe("/")
        expect(localeHomePath("hi")).toBe("/hi")
        expect(homeHash("en", "faq")).toBe("/#faq")
        expect(homeHash("hi", "faq")).toBe("/hi#faq")
    })

    it("switches homepage URLs and keeps unprefixed routes in place", () => {
        expect(localeSwitchPath("/", "hi")).toBe("/hi")
        expect(localeSwitchPath("/hi", "en")).toBe("/")
        expect(localeSwitchPath("/en", "en")).toBe("/")
        expect(localeSwitchPath("/pricing", "hi")).toBe("/pricing")
        expect(localeSwitchPath("/pricing?plan=pro", "hi")).toBe("/pricing?plan=pro")
        expect(localeSwitchPath("https://evil.example/steal", "hi")).toBe("/hi")
        expect(localeSwitchPath("https://evil.example/steal", "en")).toBe("/")
        expect(sanitizeAppPath("//evil.example")).toBe("/")
        expect(parseUiLocale("HI-IN")).toBe("hi")
        expect(parseUiLocale("fr")).toBeNull()
    })

    it("blocks two-letter locale codes as usernames by length, and longer reserved words by name", () => {
        expect(usernameError("hi")).toMatch(/3/)
        expect(usernameError("admin")).toMatch(/reserved/)
    })
})

function isIndexableBlocked(slug: string) {
    return !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || isReservedSlug(slug)
}
