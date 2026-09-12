// One-off QA render: premium themed orbs + dark canvases to a static page.
// Run: npx tsx scripts/one-off/render-premium-orbs.tsx > out.html
import Module from "node:module"
import * as React from "react"
void React

// Static harness only: CSS is inlined separately (premium-theme-orb.css).
const nodeRequire = Module.createRequire(process.cwd() + "/") as unknown as NodeRequire & { extensions: Record<string, (m: unknown) => void> }
nodeRequire.extensions[".css"] = () => undefined

async function main() {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { PremiumThemeOrb } = await import("../../src/components/premium-theme-orb")
    type PremiumOrbVariant = "astral-nebula" | "holographic-hud" | "liquid-chrome"

    const VARIANTS: { id: PremiumOrbVariant; label: string; canvas: string }[] = [
        { id: "astral-nebula", label: "Astral Nebula", canvas: "#090714" },
        { id: "holographic-hud", label: "Holographic HUD", canvas: "#060810" },
        { id: "liquid-chrome", label: "Liquid Chrome", canvas: "#0b0d12" },
    ]

    const cell = (variant: PremiumOrbVariant, mood: string, gaze: { x: number; y: number }, size = 180) =>
        renderToStaticMarkup(
            <PremiumThemeOrb variant={variant} size={size} gaze={gaze} lid="none" expression="centre" mood={mood} aura="pulse" still />,
        )

    const rows = VARIANTS.map((v) => `
    <section>
      <h2>${v.label}</h2>
      <div class="row" style="background:${v.canvas}">
        ${cell(v.id, "idle", { x: 0, y: 0 })}
        ${cell(v.id, "listening", { x: 0.6, y: -0.4 })}
        ${cell(v.id, "thinking", { x: -0.6, y: 0.3 })}
        ${cell(v.id, "idle", { x: 0.2, y: -0.2 }, 64)}
      </div>
    </section>`).join("\n")

    process.stdout.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>premium orbs</title>
<style>${nodeRequire("fs").readFileSync(__dirname + "/../../src/components/premium-theme-orb.css", "utf8")}
  body { margin: 0; background: #05070c; color: #e5e7eb; font-family: system-ui, sans-serif; padding: 32px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: #94a3b8; margin: 0 0 12px; }
  .row { display: flex; gap: 28px; align-items: center; padding: 24px; border-radius: 16px; margin-bottom: 28px; border: 1px solid rgba(255,255,255,.08); }
  svg { display: block; }
</style></head><body>${rows}</body></html>`)
}

void main()
