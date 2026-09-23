import Link from "@/components/navigation/transition-link"
import { CatalogHeader } from "@/components/shop/catalog-header"
import { whatsappHref } from "@/lib/commerce"
import {
    describeHotelGuestBookRoom,
    hotelGuestBookEmptyCopy,
    hotelGuestBookHasInventory,
    HOTEL_GUEST_BOOK_EMPTY_TITLE,
    HOTEL_GUEST_BOOK_LABEL,
    HOTEL_GUEST_BOOK_RATES_NOTE,
    type HotelGuestBookOffering,
    type HotelGuestBookRoom,
} from "@/lib/hotels/guest-book"

function formatOfferingPrice(row: HotelGuestBookOffering): string | null {
    if (row.isFree) return "Free"
    if (typeof row.priceCents === "number" && row.priceCents > 0) {
        // Honest published cents only — no invented currency formatting beyond INR-style default.
        const major = row.priceCents / 100
        return Number.isInteger(major) ? `₹${major}` : `₹${major.toFixed(2)}`
    }
    return null
}

export function HotelGuestBook({
    slug,
    name,
    logoUrl,
    whatsapp,
    aboutHref,
    hours,
    checkInTime,
    checkOutTime,
    roomCountHint,
    rooms,
    offerings,
    receptionPhone,
}: {
    slug: string
    name: string
    logoUrl?: string | null
    whatsapp?: string | null
    aboutHref?: string | null
    hours?: string | null
    checkInTime?: string | null
    checkOutTime?: string | null
    roomCountHint?: number | null
    rooms: HotelGuestBookRoom[]
    offerings: HotelGuestBookOffering[]
    receptionPhone?: string | null
}) {
    const hasInventory = hotelGuestBookHasInventory({
        roomCount: rooms.length,
        offeringCount: offerings.length,
    })
    const empty = hasInventory
        ? null
        : hotelGuestBookEmptyCopy({
              roomCount: rooms.length,
              offeringCount: offerings.length,
          })
    const wa = whatsappHref(whatsapp, `Hi ${name} — I'd like to reserve a stay`)
    const stayBits = [
        checkInTime ? `Check-in ${checkInTime}` : null,
        checkOutTime ? `Checkout ${checkOutTime}` : null,
        roomCountHint && roomCountHint > 0 && rooms.length === 0
            ? `${roomCountHint} rooms`
            : rooms.length > 0
              ? `${rooms.length} room${rooms.length === 1 ? "" : "s"} listed`
              : null,
    ].filter(Boolean) as string[]

    return (
        <div data-hotel-guest-book="true" className="min-h-dvh bg-background text-foreground">
            <CatalogHeader
                slug={slug}
                name={name}
                logoUrl={logoUrl}
                label={HOTEL_GUEST_BOOK_LABEL}
                whatsapp={whatsapp}
                aboutHref={aboutHref}
                hours={hours}
                themeToggle
            />

            <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 pb-16 lg:px-4 lg:py-6">
                <section className="rounded-2xl border border-border bg-card px-4 py-4 lg:px-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {HOTEL_GUEST_BOOK_LABEL}
                    </p>
                    <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{name}</h1>
                    {stayBits.length ? (
                        <p className="mt-1.5 text-sm text-muted-foreground">{stayBits.join(" · ")}</p>
                    ) : (
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            Stay reservations with reception — not appointment sessions.
                        </p>
                    )}
                    <p className="mt-3 text-sm text-muted-foreground">{HOTEL_GUEST_BOOK_RATES_NOTE}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={`/${slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                            data-hotel-book-chat="true"
                        >
                            Chat with concierge
                        </Link>
                        {wa ? (
                            <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                                data-hotel-book-whatsapp="true"
                            >
                                WhatsApp reception
                            </a>
                        ) : null}
                        {!wa && receptionPhone ? (
                            <a
                                href={`tel:${receptionPhone.replace(/\s+/g, "")}`}
                                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                                data-hotel-book-phone="true"
                            >
                                Call reception
                            </a>
                        ) : null}
                        <Link
                            href={`/${slug}/menu`}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                            data-hotel-book-stay="true"
                        >
                            View stay
                        </Link>
                    </div>
                </section>

                {offerings.length > 0 ? (
                    <section aria-labelledby="hotel-book-offerings-heading" className="space-y-3">
                        <div className="flex items-end justify-between gap-3 px-0.5">
                            <h2
                                id="hotel-book-offerings-heading"
                                className="text-sm font-semibold tracking-tight text-foreground"
                            >
                                Stay offerings
                            </h2>
                            <p className="text-xs text-muted-foreground">Published by the desk</p>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {offerings.map((row) => {
                                const price = formatOfferingPrice(row)
                                return (
                                    <li
                                        key={row.id}
                                        className="rounded-2xl border border-border bg-card px-4 py-3"
                                        data-hotel-book-offering={row.id}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">{row.name}</p>
                                                {row.description ? (
                                                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                        {row.description}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {price ? (
                                                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                                    {price}
                                                </p>
                                            ) : (
                                                <p className="shrink-0 text-xs text-muted-foreground">Ask reception</p>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Reserve via chat or WhatsApp — not an online checkout.
                                        </p>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                ) : null}

                {rooms.length > 0 ? (
                    <section aria-labelledby="hotel-book-rooms-heading" className="space-y-3">
                        <div className="flex items-end justify-between gap-3 px-0.5">
                            <h2
                                id="hotel-book-rooms-heading"
                                className="text-sm font-semibold tracking-tight text-foreground"
                            >
                                Rooms
                            </h2>
                            <p className="text-xs text-muted-foreground">No online rates published</p>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {rooms.map((room) => (
                                <li
                                    key={room.number}
                                    className="rounded-2xl border border-border bg-card px-4 py-3"
                                    data-hotel-book-room={room.number}
                                >
                                    <p className="text-sm font-semibold text-foreground">Room {room.number}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {describeHotelGuestBookRoom(room)}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">Ask reception for rates</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                {empty ? (
                    <section
                        data-hotel-book-empty="true"
                        data-empty-title={HOTEL_GUEST_BOOK_EMPTY_TITLE}
                        className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center"
                    >
                        <p className="text-[17px] font-semibold tracking-tight text-foreground">{empty.title}</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{empty.detail}</p>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                            <Link
                                href={`/${slug}`}
                                className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                            >
                                Chat with concierge
                            </Link>
                            {wa ? (
                                <a
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                                >
                                    WhatsApp reception
                                </a>
                            ) : null}
                        </div>
                    </section>
                ) : null}
            </main>
        </div>
    )
}
