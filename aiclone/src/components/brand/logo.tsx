import Link from "next/link"
import { cn } from "@/lib/utils"

const sizeClass = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
} as const

interface LogoProps {
    className?: string
    href?: string | null
    size?: keyof typeof sizeClass
}

export function Logo({ className, href = "/", size = "md" }: LogoProps) {
    const mark = (
        <span
            className={cn(
                "font-bold tracking-tight bg-gradient-to-r from-[#5ee7ff] to-[#00D7FF] bg-clip-text text-transparent",
                sizeClass[size],
                className,
            )}
        >
            PersonaLink
        </span>
    )

    if (href === null) return mark

    return (
        <Link href={href} className="inline-flex items-center" aria-label="PersonaLink home">
            {mark}
        </Link>
    )
}
