import { cn } from "@/lib/utils"

export function StudioDock({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <>
            <div className="h-20 shrink-0 md:h-16" aria-hidden />
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-background/92 backdrop-blur-md md:left-60",
                    className
                )}
            >
                <div className="flex items-center justify-between gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
                    {children}
                </div>
            </div>
        </>
    )
}
