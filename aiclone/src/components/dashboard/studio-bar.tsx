import { cn } from "@/lib/utils"

export function StudioBar({
    hint,
    action,
    className,
}: {
    hint?: string
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn("flex items-center justify-between gap-2", className)}>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <span />}
            {action}
        </div>
    )
}
