import { cn } from "@/lib/utils"

/** Quiet feedback for actual streamed loading states. */
export function BrandLoadingVisual({ compact = false, complete = false }: { compact?: boolean; complete?: boolean }) {
    return (
        <div className={cn("brand-loading-visual", compact && "brand-loading-visual--compact")} data-loading-option="10" data-complete={complete} aria-hidden="true">
            <svg className="brand-loading-circle" viewBox="0 0 128 128" fill="none">
                <circle cx="64" cy="64" r="58" className="brand-loading-circle-track" />
                <circle cx="64" cy="64" r="58" pathLength="100" className="brand-loading-circle-progress" />
            </svg>
            {["light", "dark"].map(mode => <svg key={mode} viewBox="0 0 260 260" className={cn("brand-loading-symbol", mode === "light" ? "dark:hidden [.auth-scene_&]:hidden" : "hidden dark:block [.auth-scene_&]:block")}>
                <image className="brand-loading-symbol-motion" href={`/brand/main/loading-${mode}.svg`} width="260" height="260" />
                <image className="brand-loading-symbol-still" href={`/brand/main/loading-${mode}-still.svg`} width="260" height="260" />
            </svg>)}
        </div>
    )
}

export function BrandLoading({
    label = "Loading page",
    fullPage = false,
    compact = false,
}: {
    label?: string
    fullPage?: boolean
    compact?: boolean
}) {
    return (
        <div className={cn("brand-loading", fullPage && "brand-loading--page", compact && "brand-loading--compact")} role="status" aria-live="polite">
            <BrandLoadingVisual compact={compact} />
            <span className="brand-loading-label">{label}</span>
        </div>
    )
}
