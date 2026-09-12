import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"
import { MascotOrb, isMascotOrbVariant } from "@/components/mascot-orb"
import { WelcomeOrb } from "@/components/welcome-orb"
import {
    BLOUB_MOODS,
    BLOUB_THEME_META,
    DEFAULT_BLOUB_PICK,
    INCLUDED_BLOUB_BOTS,
    MASCOT_THEMES,
    PREMIUM_BLOUB_BOTS,
    bloubBotPick,
    bloubThemeThumb,
    clampOrbForPlan,
    isMascotTheme,
    isNamedBloubBotSelected,
    isPremiumBloubTheme,
    lookThemesFor,
    parseOrbBag,
    resolveThemedOrb,
    usesBlobColorSlider,
    usesBlobShapes,
    writeOrbBag,
} from "@/lib/bloub/catalog"

const VARIANTS = ["retro-tv", "solid-gold", "pencil-sketch", "glass-bubble"] as const
const BOTS = { "retro-tv": "Telly", "solid-gold": "Aurum", "pencil-sketch": "Doodle", "glass-bubble": "Pearl" } as const

beforeEach(() => {
    installMatchMedia({ [REDUCE_MOTION]: true })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("mascot catalog", () => {
    it("ships Telly, Aurum, Doodle and Pearl as included bots, one theme each", () => {
        expect(MASCOT_THEMES).toEqual(VARIANTS)
        for (const theme of VARIANTS) {
            const bot = INCLUDED_BLOUB_BOTS.find((item) => item.theme === theme)!
            expect(bot?.label).toBe(BOTS[theme])
            expect(bot.themes).toBeUndefined()
            expect(isMascotTheme(theme)).toBe(true)
            expect(isPremiumBloubTheme(theme)).toBe(false)
            expect(resolveThemedOrb(theme)).toBe(theme)
            expect(BLOUB_THEME_META[theme]?.canvas.light).toBeTruthy()
            expect(BLOUB_THEME_META[theme]?.canvas.dark).toBeTruthy()
            expect(bloubThemeThumb(theme, "dark").dot).not.toBe(bloubThemeThumb(theme, "dark").bar)

            const pick = { ...DEFAULT_BLOUB_PICK, ...bloubBotPick(bot) }
            expect(pick.theme).toBe(theme)
            expect(pick.shape).toBe("cercle")
            expect([...INCLUDED_BLOUB_BOTS, ...PREMIUM_BLOUB_BOTS].filter((item) => isNamedBloubBotSelected(item, pick))).toEqual([bot])
            expect(lookThemesFor(pick).map((item) => item.id)).toEqual([theme])
            expect(usesBlobColorSlider(pick)).toBe(false)
            expect(usesBlobShapes(pick)).toBe(false)
        }
        expect(isMascotTheme("liquid-chrome")).toBe(false)
        expect(isMascotOrbVariant("planet-azure")).toBe(false)
        expect(isMascotOrbVariant(undefined)).toBe(false)
    })

    it("survives free-plan clamping and round-trips through the saved orb bag", () => {
        for (const theme of VARIANTS) {
            const free = clampOrbForPlan({ theme, shape: "nuage", look: "glass" }, false)
            expect(free.theme).toBe(theme)
            expect(free.shape).toBe("cercle")
            expect(free.look).toBe("bloub")
            const saved = writeOrbBag(undefined, { theme, expression: "timide", aura: "still" }, false)
            expect(parseOrbBag(saved)).toMatchObject({ theme, expression: "timide", aura: "still" })
        }
    })
})

describe("MascotOrb", () => {
    it("renders each character with two eyes, a mouth and unique gradient ids", () => {
        const { container } = render(<>{VARIANTS.map((variant) => <MascotOrb key={variant} variant={variant} size={200} gaze={{ x: 0.4, y: -0.2 }} expression="attentif" mood="listening" />)}</>)
        const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const variant of VARIANTS) {
            const svg = container.querySelector(`.mo-orb--${variant}`)!
            expect(svg).not.toBeNull()
            expect(svg.querySelectorAll(".mo-eye")).toHaveLength(2)
            expect(svg.querySelector(".mo-mouth")).not.toBeNull()
            expect(svg.querySelector(".mo-face")!.getAttribute("style")).toContain("translate(2.4px, 0.9px)")
        }
        for (const element of container.querySelectorAll("[fill],[stroke],[clip-path],[filter]")) {
            for (const attribute of ["fill", "stroke", "clip-path", "filter"]) {
                const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1]
                if (reference) expect(ids).toContain(reference)
            }
        }
    })

    it("winks when live and keeps the resting face in still previews", () => {
        const { container, rerender } = render(<MascotOrb variant="solid-gold" size={120} gaze={{ x: 1, y: 1 }} lid="wink-left" />)
        const eyes = () => container.querySelectorAll<SVGGElement>(".mo-eye")
        expect(eyes()[0].style.transform).toBe("scale(1, 0.12)")
        expect(eyes()[1].style.transform).toBe("none")
        rerender(<MascotOrb variant="solid-gold" size={120} gaze={{ x: 1, y: 1 }} lid="wink-left" still />)
        expect(container.querySelector(".mo-orb")!.getAttribute("data-still")).toBe("true")
        expect(container.querySelector(".mo-face")!.getAttribute("style")).toContain("translate(0px, 0px)")
        expect(eyes()[0].style.transform).toBe("none")
    })

    it("draws every saved mood distinctly and opens its mouth while speaking", () => {
        for (const variant of VARIANTS) {
            const { container, rerender, unmount } = render(<MascotOrb variant={variant} size={160} still />)
            const faces = new Set<string>()
            for (const mood of BLOUB_MOODS) {
                rerender(<MascotOrb variant={variant} size={160} expression={mood.id} still />)
                faces.add(container.querySelector(".mo-face")!.innerHTML)
                expect(container.querySelector("svg")!.getAttribute("data-expression")).toBe(mood.id)
            }
            expect(faces.size, variant).toBe(BLOUB_MOODS.length)
            rerender(<MascotOrb variant={variant} size={160} mood="speaking" />)
            const mouth = container.querySelector(".mo-mouth path, .mo-mouth")!
            expect(container.querySelector("svg")!.getAttribute("data-mood")).toBe("speaking")
            expect(Array.from(container.querySelectorAll(".mo-mouth, .mo-mouth path")).some((node) => node.getAttribute("fill") && node.getAttribute("fill") !== "none")).toBe(true)
            expect(mouth).not.toBeNull()
            unmount()
        }
    })

    it("drops decorations and heavy detail for compact previews", () => {
        const { container } = render(<MascotOrb variant="pencil-sketch" size={40} still />)
        const small = container.querySelectorAll(".mo-sketch-lines ellipse").length
        const { container: big } = render(<MascotOrb variant="pencil-sketch" size={200} still />)
        expect(small).toBeLessThan(big.querySelectorAll(".mo-sketch-lines ellipse").length)
        expect(big.querySelectorAll(".mo-sketch-lines path").length).toBeGreaterThan(0)
        expect(container.querySelectorAll(".mo-sketch-lines path")).toHaveLength(0)
    })
})

describe("WelcomeOrb mascot dispatch", () => {
    it("renders the mascot instead of the blob and marks the scene as themed", () => {
        for (const variant of VARIANTS) {
            const { container, unmount } = render(<WelcomeOrb look="bloub" theme={variant} aura="pulse" still />)
            expect(container.querySelector(`.mo-orb--${variant}`)).not.toBeNull()
            expect(container.querySelector(".pl-orb")).toBeNull()
            expect(container.querySelector(".pt-orb")).toBeNull()
            expect(container.querySelector(".pl-orb-scene")!.getAttribute("data-bot-theme")).toBe(variant)
            expect(container.querySelector(".pl-orb-scene")!.className).toContain("is-premium")
            unmount()
        }
    })
})
