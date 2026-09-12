import { cn } from "@/lib/utils"

/** Corner star that marks a Premium bot in a Free owner's grid. */
export function PremiumStar({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            data-premium-star
            className={cn(
                "pointer-events-none absolute right-1.5 top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-bold leading-none text-amber-950 shadow-sm",
                className,
            )}
        >
            ✦
        </span>
    )
}
