import Link from "@/components/navigation/transition-link"
import { CatalogHeader } from "@/components/shop/catalog-header"
import {
    describeHotelGuestRoom,
    hotelGuestMenuEmptyCopy,
    hotelGuestMenuHasContent,
    HOTEL_GUEST_MENU_EMPTY_TITLE,
    HOTEL_GUEST_MENU_LABEL,
    type HotelGuestMenuRestaurant,
    type HotelGuestMenuRoom,
} from "@/lib/hotels/guest-menu"

export function HotelGuestMenu({
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
    amenities,
    services,
    restaurants,
}: {
    slug: string
    name: string
    logoUrl?: string | null
    whatsapp?: string | null
    aboutHref?: string | null
    hours?: string | null
    checkInTime?: string | null
    checkOutTime?: string | null
    /** Property-level roomCount when individual rooms are unpublished. */
    roomCountHint?: number | null
    rooms: HotelGuestMenuRoom[]
    amenities: string[]
    services: string[]
    restaurants: HotelGuestMenuRestaurant[]
}) {
    const hasContent = hotelGuestMenuHasContent({
        roomCount: rooms.length,
        restaurantCount: restaurants.length,
        amenityCount: amenities.length,
        serviceCount: services.length,
    })
    const empty = hasContent
        ? null
        : hotelGuestMenuEmptyCopy({
            roomCount: rooms.length,
            restaurantCount: restaurants.length,
        })
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
        <div data-hotel-guest-menu="true" className="min-h-dvh bg-background text-foreground">
            <CatalogHeader
                slug={slug}
                name={name}
                logoUrl={logoUrl}
                label={HOTEL_GUEST_MENU_LABEL}
                whatsapp={whatsapp}
                aboutHref={aboutHref}
                hours={hours}
                themeToggle
            />

            <main className="mx-auto max-w-5xl space-y-6 px-3 py-5 pb-16 lg:px-4 lg:py-6">
                <section className="rounded-2xl border border-border bg-card px-4 py-4 lg:px-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {HOTEL_GUEST_MENU_LABEL}
                    </p>
                    <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{name}</h1>
                    {stayBits.length ? (
                        <p className="mt-1.5 text-sm text-muted-foreground">{stayBits.join(" · ")}</p>
                    ) : (
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            Rooms, connected kitchens, and stay facts — not a product shop.
                        </p>
                    )}
                    <p className="mt-3 text-sm text-muted-foreground">
                        Rates and availability stay with reception. Ask the concierge in chat — we do not invent inventory here.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={`/${slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                            data-hotel-menu-chat="true"
                        >
                            Chat with concierge
                        </Link>
                        {restaurants[0] ? (
                            <Link
                                href={`/${restaurants[0].slug}/menu`}
                                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
                            >
                                Open kitchen menu
                            </Link>
                        ) : null}
                    </div>
                </section>

                {rooms.length > 0 ? (
                    <section aria-labelledby="hotel-rooms-heading" className="space-y-3">
                        <div className="flex items-end justify-between gap-3 px-0.5">
                            <h2 id="hotel-rooms-heading" className="text-sm font-semibold tracking-tight text-foreground">
                                Rooms
                            </h2>
                            <p className="text-xs text-muted-foreground">No online rates published</p>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {rooms.map((room) => (
                                <li
                                    key={room.number}
                                    className="rounded-2xl border border-border bg-card px-4 py-3"
                                    data-hotel-room={room.number}
                                >
                                    <p className="text-sm font-semibold text-foreground">Room {room.number}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{describeHotelGuestRoom(room)}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                {amenities.length > 0 || services.length > 0 ? (
                    <section aria-labelledby="hotel-amenities-heading" className="space-y-3">
                        <h2 id="hotel-amenities-heading" className="px-0.5 text-sm font-semibold tracking-tight text-foreground">
                            Amenities &amp; services
                        </h2>
                        <ul className="flex flex-wrap gap-2">
                            {[...amenities, ...services].map((label) => (
                                <li
                                    key={label}
                                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
                                >
                                    {label}
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                {restaurants.length > 0 ? (
                    <section aria-labelledby="hotel-kitchens-heading" className="space-y-3">
                        <div className="space-y-1 px-0.5">
                            <h2 id="hotel-kitchens-heading" className="text-sm font-semibold tracking-tight text-foreground">
                                Dining at the hotel
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Connected Introify kitchens keep their own menus. We link them — we do not copy dishes here.
                            </p>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {restaurants.map((row) => (
                                <li key={row.slug}>
                                    <Link
                                        href={`/${row.slug}/menu`}
                                        className="block rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-foreground/30"
                                        data-hotel-linked-restaurant={row.slug}
                                    >
                                        <p className="text-sm font-semibold text-foreground">{row.label || row.name}</p>
                                        {row.headline ? (
                                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.headline}</p>
                                        ) : (
                                            <p className="mt-0.5 text-xs text-muted-foreground">Open their menu</p>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                {empty ? (
                    <section
                        data-hotel-menu-empty="true" data-empty-title={HOTEL_GUEST_MENU_EMPTY_TITLE}
                        className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center"
                    >
                        <p className="text-[17px] font-semibold tracking-tight text-foreground">{empty.title}</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{empty.detail}</p>
                        <Link
                            href={`/${slug}`}
                            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                        >
                            Chat with concierge
                        </Link>
                    </section>
                ) : null}
            </main>
        </div>
    )
}
