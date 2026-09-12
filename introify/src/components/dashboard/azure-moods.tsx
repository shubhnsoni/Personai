"use client"

import { WelcomeOrb } from "@/components/welcome-orb"
import { BLOUB_THEMES, PLANET_THEMES, type BloubPick, type PlanetThemeId } from "@/lib/bloub/catalog"
import { cn } from "@/lib/utils"

export function AzureMoods({ value, onChange, dark = false }: {
    value: BloubPick
    onChange: (next: Partial<BloubPick>) => void
    dark?: boolean
}) {
    if (value.look !== "bloub" || !PLANET_THEMES.includes(value.theme as PlanetThemeId)) return null
    return <section className="space-y-3" aria-label="Azure moods">
        <p className={cn("text-xs font-medium", dark && "text-white/60")}>Azure moods</p>
        <div className="grid grid-cols-3 gap-2">
            {PLANET_THEMES.map(theme => <button key={theme} type="button"
                aria-label={`${BLOUB_THEMES.find(item => item.id === theme)?.label} mood`}
                aria-pressed={value.theme === theme}
                onClick={() => onChange({ theme })}
                className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium",
                    dark ? value.theme === theme ? "border-white/70 bg-white/10 text-white" : "border-white/15 text-white/75 hover:bg-white/5"
                        : value.theme === theme ? "border-foreground bg-muted/60" : "hover:bg-muted/40")}>
                <WelcomeOrb still size={56} look="bloub" shape={value.shape} expression={value.expression} theme={theme} aura="still" />
                {BLOUB_THEMES.find(item => item.id === theme)?.label}
            </button>)}
        </div>
    </section>
}
