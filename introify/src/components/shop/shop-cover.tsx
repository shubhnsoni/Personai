import { FileText, Headphones, Package, Play } from "lucide-react"
import { cn } from "@/lib/utils"

const PALETTE: Record<string, { bg: string; mid: string }> = {
    PDF: { bg: "#0b3d32", mid: "#34d399" },
    VIDEO: { bg: "#1e1b4b", mid: "#818cf8" },
    AUDIO: { bg: "#431407", mid: "#fb923c" },
    OTHER: { bg: "#172554", mid: "#60a5fa" },
}

const ICONS = {
    PDF: FileText,
    VIDEO: Play,
    AUDIO: Headphones,
    OTHER: Package,
}

export function ShopCover({
    src,
    type,
    title,
    className,
}: {
    src?: string | null
    type: string
    title: string
    className?: string
}) {
    const pal = PALETTE[type] || PALETTE.OTHER
    const Icon = ICONS[type as keyof typeof ICONS] || Package

    return (
        <div className={cn("relative overflow-hidden", className)} style={{ background: pal.bg }}>
            {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-white">
                    <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ background: `${pal.mid}33`, color: pal.mid }}
                    >
                        <Icon className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">{type}</span>
                    <span className="sr-only">{title}</span>
                </div>
            )}
        </div>
    )
}

export function ShopWordmark({
    name,
    logoUrl,
    className,
}: {
    name: string
    logoUrl?: string | null
    className?: string
}) {
    if (logoUrl) {
        return (
            <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <img
                        src={logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                    />
                </span>
                <span className="truncate font-semibold tracking-tight">{name}</span>
            </span>
        )
    }
    return (
        <span className={cn("truncate font-semibold tracking-tight", className)}>
            {name}
        </span>
    )
}
