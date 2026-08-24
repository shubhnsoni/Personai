import {
    COLORS,
    DEFAULT_COLOR,
    DEFAULT_SHAPE,
    SHAPE_BY_ID,
    type ColorId,
    type ShapeId,
} from "./skins"
import {
    DEFAULT_EXPRESSION,
    EXPRESSION_BY_ID,
    type ExpressionId,
} from "./expressions"

export const BLOUB_SHAPES: { id: ShapeId; label: string }[] = [
    { id: "cercle", label: "Circle" },
    { id: "galet", label: "Pebble" },
    { id: "squircle", label: "Squircle" },
    { id: "capsule", label: "Capsule" },
    { id: "triangle", label: "Triangle" },
    { id: "hexagone", label: "Hexagon" },
    { id: "nuage", label: "Cloud" },
    { id: "goutte", label: "Droplet" },
]

export const BLOUB_EXPRESSIONS: { id: ExpressionId; label: string }[] = [
    { id: "surpris", label: "Surprised" },
    { id: "neutre", label: "Neutral" },
    { id: "attentif", label: "Attentive" },
    { id: "excite", label: "Excited" },
    { id: "heureux", label: "Happy" },
    { id: "hilare", label: "Laughing" },
    { id: "colere", label: "Angry" },
    { id: "triste", label: "Sad" },
    { id: "effraye", label: "Scared" },
    { id: "mefiant", label: "Suspicious" },
    { id: "confus", label: "Confused" },
    { id: "curieux", label: "Curious" },
    { id: "fier", label: "Proud" },
    { id: "timide", label: "Shy" },
    { id: "blase", label: "Unimpressed" },
    { id: "somnolent", label: "Sleepy" },
]

export const BLOUB_COLORS = COLORS.map((c) => ({
    id: c.id,
    hex: c.hex,
    label: (
        {
            blanc: "White",
            encre: "Ink",
            brun: "Brown",
            rouge: "Red",
            orange: "Orange",
            ambre: "Amber",
            vert: "Green",
            turquoise: "Turquoise",
            bleu: "Blue",
            violet: "Purple",
            rose: "Pink",
            gris: "Grey",
            creme: "Cream",
        } as Record<ColorId, string>
    )[c.id],
}))

export type BloubPick = {
    shape: ShapeId
    expression: ExpressionId
    color: ColorId
}

export function resolveBloubShape(id?: string | null): ShapeId {
    return SHAPE_BY_ID.has(id || "") ? (id as ShapeId) : DEFAULT_SHAPE
}

export function resolveBloubExpression(id?: string | null): ExpressionId {
    return EXPRESSION_BY_ID.has(id || "") ? (id as ExpressionId) : DEFAULT_EXPRESSION
}

export function resolveBloubColor(id?: string | null): ColorId {
    return COLORS.some((c) => c.id === id) ? (id as ColorId) : DEFAULT_COLOR
}

export function parseOrbBag(personalityConfig?: string | null): Partial<BloubPick> {
    try {
        const bag = JSON.parse(personalityConfig || "{}") as { orb?: Partial<BloubPick> }
        const orb = bag.orb || {}
        return {
            shape: orb.shape ? resolveBloubShape(orb.shape) : undefined,
            expression: orb.expression ? resolveBloubExpression(orb.expression) : undefined,
            color: orb.color ? resolveBloubColor(orb.color) : undefined,
        }
    } catch {
        return {}
    }
}

export function writeOrbBag(personalityConfig: string | undefined, next: Partial<BloubPick>): string {
    let bag: Record<string, unknown> = {}
    try {
        bag = JSON.parse(personalityConfig || "{}") as Record<string, unknown>
    } catch {
        bag = {}
    }
    const prev = (bag.orb && typeof bag.orb === "object" ? bag.orb : {}) as Partial<BloubPick>
    const orb: BloubPick = {
        shape: resolveBloubShape(next.shape ?? prev.shape),
        expression: resolveBloubExpression(next.expression ?? prev.expression),
        color: resolveBloubColor(next.color ?? prev.color),
    }
    bag.orb = orb
    return JSON.stringify(bag)
}
