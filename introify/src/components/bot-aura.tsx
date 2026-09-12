import type { CSSProperties } from "react"
import type { AuraId } from "@/lib/bloub/catalog"
import "./bot-aura.css"

/** Fine aura lines shared by every bot renderer, without a soft outer glow. */
export function BotAura({ aura, color, speed = 1, intensity = 1, still = false, frozenAt }: {
    aura: AuraId
    color: string
    speed?: number
    intensity?: number
    still?: boolean
    frozenAt?: number
}) {
    if (aura === "still") return null
    const rate = Number.isFinite(speed) ? Math.min(3, Math.max(0.35, speed)) : 1
    const strength = Number.isFinite(intensity) ? Math.min(1, Math.max(0.15, intensity * 0.65)) : 0.65
    return <span className="bot-aura" data-aura={aura} data-paused={still || frozenAt !== undefined} aria-hidden
        style={{ "--bot-aura-color": color, "--bot-aura-duration": `${(aura === "pulse" ? 2.4 : 4.8) / rate}s`, "--bot-aura-strength": strength,
            "--bot-aura-time": `${-(frozenAt ?? 0.8)}s` } as CSSProperties}>
        <span className="bot-aura-ring" /><span className="bot-aura-ring" /><span className="bot-aura-ring" />
    </span>
}
