// One-off QA render: the real bot grid (names + configs) to a static page.
// Run: npx tsx scripts/one-off/render-bots-grid.tsx > bots-grid-preview.html
import Module from "node:module"
import * as React from "react"
void React

const nodeRequire = Module.createRequire(process.cwd() + "/") as unknown as NodeRequire & { extensions: Record<string, (m: unknown) => void> }
nodeRequire.extensions[".css"] = () => undefined

async function main() {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { WelcomeOrb } = await import("../../src/components/welcome-orb")
    const { INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, BLOUB_THEME_META, bloubBotPick } = await import("../../src/lib/bloub/catalog")

    const orb = (bot: { id: string; theme: string; expression: string; color: string }, size = 96) =>
        renderToStaticMarkup(
            <WelcomeOrb still size={size} look="bloub" shape={bot.id} expression={bot.expression} color={bot.color} aura="still" theme={bot.theme} />,
        )

    const card = (bot: { id: string; label: string; expression: string; color: string; aura: string; theme: string }, premium: boolean) => {
        const pick = bloubBotPick(bot as never)
        const canvas = (BLOUB_THEME_META[bot.theme as keyof typeof BLOUB_THEME_META]?.canvas.dark) ?? "#14171f"
        return `<div class="card${premium ? " premium" : ""}" style="background:${canvas}">
            <div class="orb">${orb(bot as never)}</div>
            <div class="name">${bot.label}${premium ? '<span class="star">✦</span>' : ""}</div>
            <div class="meta">shape ${pick.shape} · ${pick.expression} · ${pick.color}</div>
            <div class="meta">aura ${pick.aura} · theme ${pick.theme}</div>
        </div>`
    }

    const out = process.argv[2]
    const fs = nodeRequire("fs") as typeof import("node:fs")
    const resolvedCss = ["premium-theme-orb.css", "welcome-orb.css", "welcome-pixel.css"]
        .map((f) => fs.readFileSync(process.cwd() + `/src/components/${f}`, "utf8"))
        .join("\n")

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Introify bots</title>
<style>${resolvedCss}
  * { box-sizing: border-box; }
  body { margin: 0; background: #090b10; color: #e5e7eb; font-family: system-ui, sans-serif; padding: 36px; }
  h1 { font-size: 22px; letter-spacing: -0.02em; margin: 0; }
  p.sub { color: #94a3b8; font-size: 13px; margin: 6px 0 26px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: #94a3b8; margin: 0 0 14px; }
  section { margin-bottom: 34px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .card .orb svg { display: block; }
  .name { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
  .name .star { margin-left: 6px; color: #d4af37; font-size: 12px; }
  .meta { font-size: 11px; color: #a5b4c9; font-family: ui-monospace, monospace; }
  .note { margin-top: 26px; padding: 14px 16px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; font-size: 12px; color: #94a3b8; max-width: 720px; line-height: 1.6; }
  code { background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 6px; }
</style></head><body>
  <h1>Introify bot grid — real components</h1>
  <p class="sub">Rendered from <code>WelcomeOrb</code> + <code>bloub/catalog</code>. Picking a bot applies its full configuration.</p>
  <section>
    <h2>Included</h2>
    <div class="grid">${INCLUDED_BLOUB_BOTS.map((b) => card(b, false)).join("")}</div>
  </section>
  <section>
    <h2>Premium</h2>
    <div class="grid">${PREMIUM_BLOUB_BOTS.map((b) => card(b, true)).join("")}</div>
  </section>
  <section>
    <h2>Theme-only bot</h2>
    <div class="grid"><div class="card" style="background:#1c2a18">
      <div class="orb">${renderToStaticMarkup(
          <WelcomeOrb still size={96} look="bloub" shape="cercle" expression="centre" color="blanc" aura="still" theme="retro-lcd" />,
      )}</div>
      <div class="name">Retro LCD</div>
      <div class="meta">shape cercle · centre · blanc</div>
      <div class="meta">aura still · theme retro-lcd</div>
    </div></div>
  </section>
  <div class="note">Configs come from <code>bloubBotPick()</code>: tap a bot in onboarding or the dashboard customizer and its shape, expression, colour, aura and theme apply together.</div>
</body></html>`
    fs.mkdirSync(nodeRequire("path").dirname(out ?? "bots-grid-preview.html"), { recursive: true })
    fs.writeFileSync(out ?? "bots-grid-preview.html", html)
}

void main()
