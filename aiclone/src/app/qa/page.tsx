import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE, TRY_KITS } from "@/lib/try-kits"
import { openTryKit } from "@/app/actions/try-kits"
import { surfacesFor, leadsNavLabel, salesNavLabel, shopNavLabel } from "@/lib/surfaces"

export const dynamic = "force-dynamic"

const KIT_SECTIONS = [
    {
        category: "new",
        eyebrow: "New",
        title: "New business profiles",
        description: "Open the shared engines added in the latest Business OS waves.",
    },
    {
        category: "classic",
        eyebrow: "Original",
        title: "Classic profiles",
        description: "The original public-page, commerce, booking, and portfolio kits.",
    },
] as const

export default async function QaKitsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (user.profiles.length === 0) redirect("/onboarding")

    const jar = await cookies()
    const activeId = jar.get(ACTIVE_PROFILE_COOKIE)?.value
    const owned = await prisma.profile.findMany({
        where: { userId: user.id, slug: { startsWith: "try-" } },
        select: { id: true, slug: true, roleTemplate: true },
    })
    const byRole = new Map(owned.map((p) => [p.roleTemplate, p]))

    return (
        <div className="min-h-dvh bg-background px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-lg">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-aurora">QA profiles</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">Try every business profile</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Open a temporary studio as that profile, or walk through its onboarding path.
                </p>

                <div className="mt-7 space-y-8">
                    {KIT_SECTIONS.map((section) => (
                        <section key={section.category} aria-labelledby={`qa-${section.category}-profiles`}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-aurora">{section.eyebrow}</p>
                            <h2 id={`qa-${section.category}-profiles`} className="mt-1 text-lg font-semibold tracking-tight">{section.title}</h2>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
                            <div className="mt-3 grid gap-2.5">
                    {TRY_KITS.filter((kit) => kit.category === section.category).map((kit) => {
                        const existing = byRole.get(kit.role)
                        const surfaces = surfacesFor(kit.role)
                            .filter((s) => s !== "home" && s !== "profile" && s !== "inbox")
                            .map((s) => {
                                if (s === "shop") return shopNavLabel(kit.role)
                                if (s === "leads") return leadsNavLabel(kit.role)
                                if (s === "sales") return salesNavLabel(kit.role)
                                return s
                            })
                        const on = existing && existing.id === activeId
                        return (
                            <div key={kit.role} className="rounded-2xl border border-border/70 bg-card px-4 py-3.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium">{kit.name}</p>
                                            {on ? (
                                                <span className="rounded-full bg-aurora/15 px-2 py-0.5 text-[10px] font-medium text-aurora">Open now</span>
                                            ) : existing ? (
                                                <span className="text-[10px] text-muted-foreground">Ready</span>
                                            ) : null}
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{kit.blurb}</p>
                                        <p className="mt-1.5 text-[11px] capitalize text-muted-foreground/80">
                                            {surfaces.length ? surfaces.join(" · ") : "Home · Profile · Chats"}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <form action={openTryKit} className="flex-1">
                                        <input type="hidden" name="role" value={kit.role} />
                                        <button type="submit" className="h-9 w-full rounded-full bg-foreground text-xs font-medium text-background">
                                            Studio
                                        </button>
                                    </form>
                                    <a
                                        href={`/qa/onboard?role=${kit.role}`}
                                        className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-border/70 text-xs font-medium"
                                    >
                                        Onboarding
                                    </a>
                                </div>
                            </div>
                        )
                    })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    )
}
