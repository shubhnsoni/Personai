import type { CSSProperties } from "react"
import { EXPRESSION_BY_ID, type ExpressionId } from "./bloub/expressions"

const LIVE_EXPRESSION: Record<string, ExpressionId> = {
    greeting: "excite", listening: "attentif", thinking: "confus",
    speaking: "curieux", success: "heureux", error: "triste", react: "heureux",
}

/** Conversation states temporarily override the saved resting expression. */
export function resolveBotExpression(saved?: string | null, mood = "idle"): ExpressionId {
    return LIVE_EXPRESSION[mood] ?? (EXPRESSION_BY_ID.has(saved as ExpressionId) ? saved as ExpressionId : "centre")
}

type Pose = [number, number, number, number, number, number, number, number, number]
// Eye X/Y scale, left/right angle, gap, face angle/Y, mouth scale/angle.
const POSES: Record<ExpressionId, Pose> = {
    centre: [1, 1, 0, 0, 1, 0, 0, 1, 0],
    neutre: [1, .9, 0, 0, 1, 0, 1, .85, 0],
    attentif: [.85, 1.18, 0, 0, .95, -4, -1, .85, 0],
    surpris: [1.2, 1.3, 0, 0, 1.12, 0, -2, 1.35, 0],
    excite: [1.14, 1.18, -8, 8, 1.1, 0, -2, 1.25, 0],
    heureux: [1.12, .55, 12, -12, 1, 0, -1, 1.18, 0],
    hilare: [1.16, .32, 15, -15, 1.12, -3, -1, 1.4, 0],
    colere: [1.05, .65, -22, 22, .9, 0, 1, .8, 180],
    triste: [.9, .68, 20, -20, .94, 0, 3, .85, 180],
    effraye: [.75, 1.3, 13, -13, 1.17, -4, 1, 1.2, 0],
    mefiant: [1.05, .52, -13, 7, .96, 5, 0, .65, 0],
    confus: [1, .85, -12, -12, 1.07, -9, -1, .75, -12],
    curieux: [.93, 1.12, -5, -5, 1.05, 7, -2, .9, -8],
    fier: [1.05, .7, 9, -9, 1.13, 0, -3, 1.1, -5],
    timide: [.75, .6, 10, -10, .85, -7, 3, .65, 0],
    blase: [1.1, .35, 0, 0, 1.02, 4, 2, .65, 180],
    somnolent: [1.05, .18, 5, -5, .95, -8, 3, .6, 0],
}

/** Individual CSS transforms keep static expressions visible during animation and when paused. */
export function botExpressionStyle(expression: ExpressionId): CSSProperties {
    const [x, y, left, right, gap, angle, offset, mouth, mouthAngle] = POSES[expression]
    return {
        "--bot-eye-x": x, "--bot-eye-y": y,
        "--bot-eye-left-angle": `${left}deg`, "--bot-eye-right-angle": `${right}deg`,
        "--bot-eye-gap": gap, "--bot-face-angle": `${angle}deg`, "--bot-face-y": `${offset}%`,
        "--bot-mouth-scale": mouth, "--bot-mouth-angle": `${mouthAngle}deg`,
    } as CSSProperties
}
