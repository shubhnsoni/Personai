import Link from "@/components/navigation/transition-link"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { whatsappHref } from "@/lib/commerce"
import {
    CREATOR_GUEST_BOOK_LABEL,
    creatorGuestBookEmptyCopy,
    creatorGuestBookLabel,
} from "@/lib/creator/guest-book"

/**
 * Guest-honest empty /book for CREATOR / COLLECT_LEADS kits with no offerings.
 * Desktop uses the same max-w-5xl catalog shell as CreatorGuestMenu — never a phone-shell column.
 * Never renders appointment empty chrome.
 */
export function CreatorGuestBook({
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
    const label = creatorGuestBookLabel(role, primaryGoal) || CREATOR_GUEST_BOOK_LABEL
    const empty = creatorGuestBookEmptyCopy({
        displayName: name,
        whatsapp: Boolean(whatsapp),
    })
    const wa = whatsappHref(whatsapp, `Hi ${name} — I'd like to get in touch`)

    return (
        <div data-creator-guest-book="true" className="min-h-dvh bg-background text-foreground">
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
                        Get in touch — WhatsApp or chat. Lead contact, not online appointments.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={`/${slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                            data-creator-book-chat="true"
                        >
                            {empty.chatLabel}
                        </Link>
                        {wa ? (
                            <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                                data-creator-book-whatsapp="true"
                            >
                                {empty.waLabel}
                            </a>
                        ) : null}
                        <Link
                            href={`/${slug}/menu`}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                            data-creator-book-menu="true"
                        >
                            View work
                        </Link>
                    </div>
                </section>

                <section
                    data-creator-book-empty="true"
                    data-empty-title={empty.title}
                    className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center"
                >
                    <p className="text-[17px] font-semibold tracking-tight text-foreground">{empty.title}</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{empty.detail}</p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <Link
                            href={`/${slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                        >
                            {empty.chatLabel}
                        </Link>
                        {wa ? (
                            <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                            >
                                {empty.waLabel}
                            </a>
                        ) : null}
                    </div>
                </section>
            </main>
        </div>
    )
}
