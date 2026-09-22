import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isRestaurant } from "@/lib/menu"
import { menuUrl, qrSvg } from "@/lib/restaurants/print-kit"
import { GuestPrintActions } from "@/components/profile/guest-qr-share"

export const dynamic = "force-dynamic"

function money(cents: number, currency: string) {
    try {
        return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100)
    } catch {
        return `${currency} ${(cents / 100).toFixed(2)}`
    }
}

export default async function GuestPrintPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
            id: true,
            displayName: true,
            isPublic: true,
            roleTemplate: true,
            slug: true,
            themeColor: true,
            shopLogoUrl: true,
            imageUrl: true,
            digitalProducts: {
                where: { isActive: true },
                orderBy: [{ category: "asc" }, { title: "asc" }],
                select: { title: true, priceCents: true, currency: true, category: true },
                take: 80,
            },
        },
    })
    if (!profile || !profile.isPublic) notFound()

    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "introify.com"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${proto}://${host}`
    const food = isRestaurant(profile.roleTemplate)
    const accent = profile.themeColor && profile.themeColor !== "#000000" ? profile.themeColor : "#00D7FF"
    const target = food
        ? menuUrl(origin, profile.slug)
        : `${origin}/${profile.slug}`
    const qr = qrSvg(target, { dark: "#141311", light: "#fffdf8" })
    const logo = profile.shopLogoUrl || profile.imageUrl
    const tables = food
        ? await prisma.restaurantTable.findMany({
            where: { profileId: profile.id, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            take: 12,
            select: { label: true, code: true },
        })
        : []

    return (
        <div className="min-h-dvh bg-[#fbf7ef] text-[#141311]">
            <GuestPrintActions slug={profile.slug} />
            <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-2 print:max-w-none print:px-0 print:pb-0 print:pt-0">
                <section
                    className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
                    style={{ borderTopWidth: 6, borderTopColor: accent }}
                >
                    <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                {logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logo} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10" />
                                ) : null}
                                <div className="min-w-0">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.22em]" style={{ color: accent }}>
                                        {food ? "Menu QR" : "Page QR"}
                                    </p>
                                    <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
                                </div>
                            </div>
                            <p className="text-sm text-[#3f3a34]">
                                {food
                                    ? "Scan for the live menu. Works on any phone — no app."
                                    : "Scan to open this Introify page."}
                            </p>
                            <p className="break-all font-mono text-[11px] text-[#6b645b]">{target.replace(/^https?:\/\//, "")}</p>
                        </div>
                        <div
                            className="mx-auto w-[min(100%,220px)] shrink-0 sm:mx-0"
                            dangerouslySetInnerHTML={{ __html: qr }}
                        />
                    </div>
                </section>

                {food ? (
                    <section className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                            <h2 className="text-lg font-semibold tracking-tight">Menu</h2>
                            <p className="text-xs text-[#6b645b]">{profile.digitalProducts.length ? `${profile.digitalProducts.length} listed` : "Empty"}</p>
                        </div>
                        {profile.digitalProducts.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-black/15 bg-white/70 px-4 py-8 text-center text-sm text-[#6b645b]">
                                No dishes published yet — print the QR now, fill the menu later.
                            </p>
                        ) : (
                            <ul className="divide-y divide-black/8 overflow-hidden rounded-2xl border border-black/10 bg-white">
                                {profile.digitalProducts.map((item, index) => (
                                    <li key={`${item.title}-${index}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                                        <span className="min-w-0">
                                            <span className="font-medium">{item.title}</span>
                                            {item.category ? (
                                                <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-[#6b645b]">{item.category}</span>
                                            ) : null}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-[#3f3a34]">{money(item.priceCents, item.currency || "INR")}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}

                {food && tables.length ? (
                    <section className="space-y-3 break-before-page print:break-before-page">
                        <h2 className="text-lg font-semibold tracking-tight">Table QRs</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {tables.map((table) => {
                                const url = menuUrl(origin, profile.slug, table.code)
                                const svg = qrSvg(url, { dark: "#141311", light: "#fffdf8" })
                                return (
                                    <article key={table.code} className="rounded-2xl border border-black/10 bg-white p-3 text-center">
                                        <p className="mb-2 text-sm font-medium">{table.label}</p>
                                        <div className="mx-auto w-[78%]" dangerouslySetInnerHTML={{ __html: svg }} />
                                    </article>
                                )
                            })}
                        </div>
                    </section>
                ) : null}

                {food && !tables.length ? (
                    <p className="rounded-2xl border border-dashed border-black/15 bg-white/70 px-4 py-6 text-center text-sm text-[#6b645b]">
                        No active tables yet — counter / menu QR above still works. Add tables on the floor desk for per-table codes.
                    </p>
                ) : null}

                {!food ? (
                    <p className="text-center text-sm text-[#6b645b]">
                        Prefer the downloadable hotel print package? Use Dashboard → QR &amp; Print when this page is a hotel kit.
                    </p>
                ) : null}
            </main>
            <style>{`
                @media print {
                    @page { margin: 12mm; }
                    body { background: #fff !important; }
                    .print\\:hidden { display: none !important; }
                }
                @media (max-width: 390px) {
                    main { padding-left: 0.75rem; padding-right: 0.75rem; }
                }
            `}</style>
        </div>
    )
}
