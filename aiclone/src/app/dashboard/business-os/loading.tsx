import { Loader2 } from "lucide-react"

export default function BusinessOsLoading() {
    return (
        <div className="flex h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading Business OS…</p>
            </div>
        </div>
    )
}
