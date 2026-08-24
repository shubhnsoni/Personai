import {
    BookOpen,
    Calendar,
    Clock,
    FileText,
    Headphones,
    Package,
    Play,
    Users,
    Video,
    Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PALETTE: Record<string, { bg: string; mid: string }> = {
    PDF: { bg: "#0b3d32", mid: "#34d399" },
    VIDEO: { bg: "#1e1b4b", mid: "#818cf8" },
    AUDIO: { bg: "#431407", mid: "#fb923c" },
    OTHER: { bg: "#172554", mid: "#60a5fa" },
    COURSE: { bg: "#1e1b4b", mid: "#818cf8" },
    ALL: { bg: "#1e1b4b", mid: "#818cf8" },
    BEGINNER: { bg: "#0b3d32", mid: "#34d399" },
    INTERMEDIATE: { bg: "#431407", mid: "#fb923c" },
    WEBINAR: { bg: "#1e1b4b", mid: "#818cf8" },
    WORKSHOP: { bg: "#431407", mid: "#fb923c" },
    MEETUP: { bg: "#0b3d32", mid: "#34d399" },
    SERVICE: { bg: "#042f2e", mid: "#2dd4bf" },
}

const ICONS: Record<string, typeof Package> = {
    PDF: FileText,
    VIDEO: Play,
    AUDIO: Headphones,
    OTHER: Package,
    COURSE: BookOpen,
    ALL: BookOpen,
    BEGINNER: BookOpen,
    INTERMEDIATE: BookOpen,
    WEBINAR: Video,
    WORKSHOP: Wrench,
    MEETUP: Users,
    SERVICE: Clock,
    EVENT: Calendar,
}

export function OfferCover({
    src,
    kind,
    title,
    kicker,
    hideIcon,
    className,
}: {
    src?: string | null
    kind: string
    title: string
    kicker?: string
    hideIcon?: boolean
    className?: string
}) {
    const pal = PALETTE[kind] || PALETTE.OTHER
    const Icon = ICONS[kind] || Package

    return (
        <div className={cn("relative overflow-hidden", className)} style={{ background: pal.bg }}>
            {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" />
            ) : hideIcon ? (
                <div className="flex h-full items-center justify-center p-1 text-white">
                    <span className="text-[11px] font-medium tabular-nums" style={{ color: pal.mid }}>
                        {kicker}
                    </span>
                    <span className="sr-only">{title}</span>
                </div>
            ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-white">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl"
                        style={{ background: `${pal.mid}33`, color: pal.mid }}
                    >
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
                        {kicker || kind}
                    </span>
                    <span className="sr-only">{title}</span>
                </div>
            )}
        </div>
    )
}

export { formatMoney as money } from "@/lib/pricing"
