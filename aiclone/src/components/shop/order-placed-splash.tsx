"use client"

import { useEffect } from "react"

export function OrderPlacedSplash({
    shopName,
    number,
    dish,
    onDone,
}: {
    shopName: string
    number: number
    dish?: string | null
    onDone: () => void
}) {
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const id = window.setTimeout(onDone, reduce ? 500 : 3800)
        return () => window.clearTimeout(id)
    }, [onDone])

    return (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#07080b] px-6 text-white">
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
                backgroundSize: "28px 28px",
            }} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
            <div className="relative h-64 w-64">
                <div className="pl-glow absolute left-1/2 top-[62%] h-28 w-48 -translate-x-1/2 rounded-full bg-orange-500/40 blur-3xl" />
                <div className="pl-glow-cyan absolute left-1/2 top-[18%] h-24 w-40 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />

                <span className="pl-ember absolute left-[22%] bottom-24 h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="pl-ember absolute left-[70%] bottom-28 h-1 w-1 rounded-full bg-orange-400 [animation-delay:180ms]" />
                <span className="pl-ember absolute left-[48%] bottom-32 h-1.5 w-1.5 rounded-full bg-yellow-200 [animation-delay:340ms]" />
                <span className="pl-ember absolute left-[34%] bottom-36 h-1 w-1 rounded-full bg-cyan-200 [animation-delay:520ms]" />

                <div className="pl-flame absolute bottom-[4.6rem] left-1/2 h-12 w-9 -translate-x-1/2 rounded-[50%_50%_45%_45%] bg-gradient-to-t from-orange-700 via-amber-400 to-yellow-100" />
                <div className="pl-flame absolute bottom-[5.1rem] left-[40%] h-8 w-5 rounded-[50%_50%_45%_45%] bg-gradient-to-t from-red-700 via-orange-500 to-amber-200 [animation-delay:110ms]" />
                <div className="pl-flame absolute bottom-[5.1rem] right-[40%] h-9 w-5 rounded-[50%_50%_45%_45%] bg-gradient-to-t from-orange-800 via-amber-400 to-yellow-50 [animation-delay:220ms]" />

                <div className="absolute bottom-11 left-1/2 h-[5.1rem] w-[10.4rem] -translate-x-1/2 rounded-[2.8rem] bg-gradient-to-b from-zinc-500 via-zinc-800 to-zinc-950 shadow-[0_24px_50px_-18px_rgba(0,215,255,0.35)] ring-1 ring-white/15" />
                <div className="absolute bottom-[4.55rem] left-1/2 h-[0.7rem] w-[8.6rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500/0 via-amber-200 to-cyan-300/30" />
                <div className="pl-oil absolute bottom-[4.72rem] left-1/2 h-2 w-[6.4rem] -translate-x-1/2 rounded-full bg-amber-300/50" />
                <div className="absolute bottom-[3.35rem] right-1 h-2.5 w-[4.6rem] rotate-[18deg] rounded-full bg-gradient-to-r from-zinc-600 to-zinc-800 ring-1 ring-white/10" />
                <div className="absolute bottom-[3.55rem] right-[4.4rem] h-3 w-3 rounded-full bg-zinc-700 ring-1 ring-white/10" />

                <span className="pl-steam absolute left-[26%] top-2 h-[5.4rem] w-7 rounded-full bg-cyan-100/35 blur-md" />
                <span className="pl-steam absolute left-1/2 top-0 h-28 w-8 -translate-x-1/2 rounded-full bg-white/30 blur-md [animation-delay:220ms]" />
                <span className="pl-steam absolute right-[26%] top-4 h-[5rem] w-7 rounded-full bg-sky-200/30 blur-md [animation-delay:420ms]" />

                <div className="pl-ring absolute inset-2 rounded-full border border-cyan-400/20" />
                <div className="pl-ring-slow absolute inset-6 rounded-full border border-white/10" />
            </div>

            <p className="pl-title mt-1 text-center text-[1.85rem] font-semibold tracking-tight">Kitchen&apos;s on it</p>
            <p className="mt-1 max-w-xs text-center text-sm text-zinc-400">
                {shopName} · #{number}{dish ? ` · ${dish}` : ""}
            </p>
            <div className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
                <div className="pl-bar h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-400 to-cyan-200" />
            </div>
            <style>{`
                @keyframes pl-steam { 0% { transform: translateY(18px) scale(.65); opacity: 0; } 28% { opacity: .75; } 100% { transform: translateY(-42px) scale(1.2); opacity: 0; } }
                @keyframes pl-flame { 0%,100% { transform: translateX(-50%) scaleY(1); } 50% { transform: translateX(-50%) scaleY(1.22) translateY(-3px); } }
                @keyframes pl-bar { from { width: 0; } to { width: 100%; } }
                @keyframes pl-glow { 0%,100% { opacity: .28; transform: translateX(-50%) scale(1); } 50% { opacity: .7; transform: translateX(-50%) scale(1.08); } }
                @keyframes pl-oil { 0%,100% { transform: translateX(-50%) scaleX(1); opacity: .45; } 50% { transform: translateX(-50%) scaleX(1.12); opacity: .8; } }
                @keyframes pl-ember { 0% { transform: translateY(0) scale(1); opacity: .9; } 100% { transform: translateY(-46px) scale(.4); opacity: 0; } }
                @keyframes pl-ring { 0% { transform: scale(.92); opacity: .15; } 70% { opacity: .35; } 100% { transform: scale(1.08); opacity: 0; } }
                @keyframes pl-title { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
                .pl-steam { animation: pl-steam 1.55s ease-in-out infinite; }
                .pl-flame { animation: pl-flame .62s ease-in-out infinite; transform-origin: bottom center; }
                .pl-bar { animation: pl-bar 3.5s linear forwards; }
                .pl-glow { animation: pl-glow 1.15s ease-in-out infinite; }
                .pl-glow-cyan { animation: pl-glow 1.8s ease-in-out infinite; }
                .pl-oil { animation: pl-oil 1.1s ease-in-out infinite; }
                .pl-ember { animation: pl-ember 1.4s ease-out infinite; }
                .pl-ring { animation: pl-ring 2.2s ease-out infinite; }
                .pl-ring-slow { animation: pl-ring 3.2s ease-out infinite; }
                .pl-title { animation: pl-title .5s ease-out both; }
                @media (prefers-reduced-motion: reduce) {
                    .pl-steam,.pl-flame,.pl-glow,.pl-glow-cyan,.pl-oil,.pl-ember,.pl-ring,.pl-ring-slow { animation: none; }
                    .pl-bar { width: 100%; }
                }
            `}</style>
        </div>
    )
}
