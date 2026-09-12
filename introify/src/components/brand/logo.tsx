import Link from "@/components/navigation/transition-link"
import { cn } from "@/lib/utils"
import { IntroifyWordmark } from "./wordmark"
import { IntroifyIcon } from "./icon"

const sizeClass = {
    sm: "w-[144px]",
    md: "w-[173px]",
    lg: "w-[236px]",
} as const

const iconSizeClass = {
    sm: "w-8",
    md: "w-10",
    lg: "w-14",
} as const

interface LogoProps {
    className?: string
    href?: string | null
    size?: keyof typeof sizeClass
    variant?: "lockup" | "icon"
}

export function Logo({ className, href = "/", size = "md", variant = "lockup" }: LogoProps) {
    const Artwork = variant === "icon" ? IntroifyIcon : IntroifyWordmark
    const mark = (
        <span
            className={cn(
                "inline-flex max-w-full shrink-0 items-center text-foreground [--brand-accent:#0073D5] dark:text-[#fdfdfd] dark:[--brand-accent:#00D7FF] [.auth-scene_&]:text-[#fdfdfd] [.auth-scene_&]:[--brand-accent:#00D7FF]",
                variant === "icon" ? iconSizeClass[size] : sizeClass[size],
                className,
            )}
        >
            <Artwork className="block h-auto w-full" decorative={href !== null} />
        </span>
    )

    if (href === null) return mark

    return (
        <Link href={href} className="inline-flex max-w-full items-center" aria-label="Introify home">
            {mark}
        </Link>
    )
}
