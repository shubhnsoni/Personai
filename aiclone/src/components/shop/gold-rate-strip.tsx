import type { GoldBoard } from "@/lib/metal/board"
import { formatRatePerGram } from "@/lib/metal/math"

export function GoldRateStrip({
    board,
    wholesale = false,
    tone = "dark",
}: {
    board: GoldBoard | null
    wholesale?: boolean
    tone?: "dark" | "light"
}) {
    if (!board) return null
    const asOf = new Date(board.asOf).toLocaleString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
    })
    const light = tone === "light"
    return (
        <div className={light
            ? "rounded-[1rem] border border-[rgba(11,18,32,0.08)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(11,18,32,0.04)]"
            : "rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-2.5"
        }>
            <p className={light ? "text-[11px] uppercase tracking-[0.16em] text-[#5c6570]" : "text-[11px] uppercase tracking-[0.16em] text-zinc-500"}>{board.city} board</p>
            <p className={light ? "mt-0.5 text-sm text-[#0b1220]" : "mt-0.5 text-sm text-zinc-100"}>
                {wholesale ? (
                    <>
                        24K {formatRatePerGram(board.k24PaisePer10g)}
                        <span className={light ? "text-[#5c6570]" : "text-zinc-500"}> · 22K {formatRatePerGram(board.k22PaisePer10g)}</span>
                    </>
                ) : (
                    <>
                        22K {formatRatePerGram(board.k22PaisePer10g)}
                        <span className={light ? "text-[#5c6570]" : "text-zinc-500"}> · 24K {formatRatePerGram(board.k24PaisePer10g)}</span>
                    </>
                )}
            </p>
            <p className={light ? "mt-0.5 text-[12px] text-[#8b949e]" : "mt-0.5 text-[12px] text-zinc-500"}>
                as of {asOf} · {wholesale ? "bills in touch" : "metal + making"}
            </p>
        </div>
    )
}
