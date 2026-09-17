import type { HotelActionCard } from "@/lib/hotels"
import { hotelRequestStatusLabel } from "@/lib/hotels"
import { cn } from "@/lib/utils"

export function HotelActionCardView({ card }: { card: HotelActionCard }) {
    return (
        <div className="mt-2 max-w-sm rounded-2xl border border-white/12 bg-white/[0.04] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300/80">{card.type.replace("_", " ")}</p>
            <p className="mt-1 text-sm font-medium">{card.title}</p>
            {card.room ? <p className="text-xs text-muted-foreground">Room {card.room}</p> : null}
            {card.status ? (
                <p className={cn("mt-1 text-xs", card.status === "COMPLETE" ? "text-emerald-300" : "text-cyan-200")}>
                    {hotelRequestStatusLabel(card.status)}
                </p>
            ) : null}
            {card.items?.length ? (
                <ul className="mt-2 space-y-0.5 text-sm">
                    {card.items.map((item) => <li key={item}>· {item}</li>)}
                </ul>
            ) : null}
            {card.restaurants?.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                    {card.restaurants.map((row) => (
                        <li key={row.slug}>
                            <a className="text-cyan-200 underline-offset-2 hover:underline" href={`/${row.slug}`}>{row.name}</a>
                        </li>
                    ))}
                </ul>
            ) : null}
            {card.wifiName ? <p className="mt-2 text-sm">Network <span className="font-medium">{card.wifiName}</span></p> : null}
            {card.note ? <p className="mt-2 text-xs text-muted-foreground">{card.note}</p> : null}
        </div>
    )
}
