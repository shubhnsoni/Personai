import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ProfileFrameProps {
    className?: string
    href?: string
}

export function ProfileFrame({ className, href = "/demo" }: ProfileFrameProps) {
    return (
        <Link
            href={href}
            aria-label="Open the live PersonaLink demo profile"
            className={cn(
                "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                className,
            )}
        >
            <figure className="overflow-hidden rounded-2xl border border-white/10 bg-profile shadow-[0_40px_80px_-32px_rgba(168,85,247,0.45)] transition-transform duration-300 group-hover:-translate-y-0.5">
                <div className="flex items-center gap-2 border-b border-white/5 bg-black/40 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" aria-hidden />
                    <span className="mx-auto truncate text-micro text-zinc-500">
                        personalink.com/demo
                    </span>
                    <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-purple-300">
                        Live
                    </span>
                </div>
                <Image
                    src="/demo-profile.jpg"
                    alt="Riley Vale's live PersonaLink profile — chat, book a call, and buy"
                    width={1280}
                    height={720}
                    priority
                    className="h-auto w-full"
                />
            </figure>
        </Link>
    )
}
