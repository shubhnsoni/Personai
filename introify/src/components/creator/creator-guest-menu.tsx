import Link from "@/components/navigation/transition-link"
import { CatalogHeader } from "@/components/shop/catalog-header"
import {
    creatorGuestMenuEmptyCopy,
    creatorGuestMenuLabel,
} from "@/lib/creator/guest-menu"

/**
 * Guest-honest empty catalog for DESIGNER / DEVELOPER / SHOW_PORTFOLIO kits.
 * Desktop uses the same max-w-5xl catalog shell as Shop — never a phone-shell column.
 */
export function CreatorGuestMenu({
    slug,
    name,
    logoUrl,
    whatsapp,
    aboutHref,
    hours,
    role,
    primaryGoal,
}: {
    slug: string
    name: string
    logoUrl?: string | null
    whatsapp?: string | null
    aboutHref?: string | null
    hours?: string | null
    role?: string | null
    primaryGoal?: string | null
}) {
    const label = creatorGuestMenuLabel(role, primaryGoal)
    const empty = creatorGuestMenuEmptyCopy({ displayName: name, role, primaryGoal })

    return (
        <div data-creator-guest-menu="true" className="min-h-dvh bg-background text-foreground">
            <CatalogHeader
                slug={slug}
                name={name}
                logoUrl={logoUrl}
                label={label}
                whatsapp={whatsapp}
                aboutHref={aboutHref}
                hours={hours}
                themeToggle
            />

            <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 pb-16 lg:px-4 lg:py-6">
                <section className="rounded-2xl border border-border bg-card px-4 py-4 lg:px-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {label}
                    </p>
                    <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{name}</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Selected work and conversations — not a product import desk.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={`/${slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                            data-creator-menu-chat="true"
                        >
                            {empty.chatLabel}
                        </Link>
                    </div>
                </section>

                <section
                    data-creator-menu-empty="true"
                    data-empty-title={empty.title}
                    className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center"
                >
                    <p className="text-[17px] font-semibold tracking-tight text-foreground">{empty.title}</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{empty.detail}</p>
                    <Link
                        href={`/${slug}`}
                        className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                    >
                        {empty.chatLabel}
                    </Link>
                </section>
            </main>
        </div>
    )
}
