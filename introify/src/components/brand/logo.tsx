import Link from "@/components/navigation/transition-link"
import { cn } from "@/lib/utils"
import { IntroifyWordmark } from "./wordmark"

const sizeClass = {
    sm: "w-[110px]",
    md: "w-[132px]",
    lg: "w-[180px]",
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
                "inline-flex max-w-full shrink-0 items-center text-[#073d30] [--brand-accent:#4e7425] dark:text-[#fdfdfd] dark:[--brand-accent:var(--mk-action,#00d7ff)] [.auth-scene_&]:text-[#fdfdfd] [.auth-scene_&]:[--brand-accent:#a3db42] dark:[.auth-scene_&]:[--brand-accent:var(--mk-action,#00d7ff)]",
                sizeClass[size],
                className,
            )}
        >
            <IntroifyWordmark className="block h-auto w-full" decorative={href !== null} />
        </span>
    )

    if (href === null) return mark

    return (
        <Link href={href} className="inline-flex max-w-full items-center" aria-label="Introify home">
            {mark}
        </Link>
    )
}
