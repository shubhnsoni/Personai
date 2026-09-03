import type { GoldBoard } from "@/lib/metal/board"
import { formatRatePerGram } from "@/lib/metal/math"

export function GoldRateStrip({ board, wholesale = false }: { board: GoldBoard | null; wholesale?: boolean }) {
    if (!board) return null
    const asOf = new Date(board.asOf).toLocaleString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
    })
    return (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{board.city} board</p>
            <p className="mt-0.5 text-sm text-zinc-100">
                {wholesale ? (
                    <>
                        24K {formatRatePerGram(board.k24PaisePer10g)}
                        <span className="text-zinc-500"> · 22K {formatRatePerGram(board.k22PaisePer10g)}</span>
                    </>
                ) : (
                    <>
                        22K {formatRatePerGram(board.k22PaisePer10g)}
                        <span className="text-zinc-500"> · 24K {formatRatePerGram(board.k24PaisePer10g)}</span>
                    </>
                )}
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-500">
                as of {asOf} · {wholesale ? "bills in touch" : "metal + making"}
            </p>
        </div>
    )
}
