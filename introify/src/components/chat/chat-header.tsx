import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ChatHeaderProps {
    /** Avatar and a truncating name. Keep the avatar in a shrink-0 wrapper. */
    identity?: ReactNode
    /** Existing About, booking, or other primary profile action. */
    primaryAction?: ReactNode
    /** Persistent utilities, such as the theme toggle. */
    actions?: ReactNode
    /** Social links are placed on their own row on narrow screens. */
    links?: ReactNode
    className?: string
}

/** Keep every header control in the same layout so no toolbar covers an action. */
export function ChatHeader({ identity, primaryAction, actions, links, className }: ChatHeaderProps) {
    if (!identity && !primaryAction && !actions && !links) return null

    return (
        <header
            data-chat-header
            className={cn(
                "relative z-20 grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-black/5 bg-profile px-3 py-2 text-profile-text dark:border-white/5 sm:gap-x-3 sm:px-6",
                links && "md:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto]",
                className,
            )}
        >
            <div data-chat-identity className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 overflow-hidden">
                {identity}
            </div>

            <div
                data-chat-header-actions
                className={cn(
                    "col-start-2 row-start-1 flex min-w-0 shrink-0 items-center justify-end gap-2",
                    links && "md:col-start-3",
                )}
            >
                {primaryAction && (
                    <div
                        data-chat-primary-action
                        className="flex max-w-[38vw] min-w-0 items-center sm:max-w-60 [&>button]:m-0 [&>button]:min-h-10 [&>button]:max-w-full [&>button]:whitespace-normal [&>button]:py-1.5 [&>button]:text-center [&>button]:leading-snug"
                    >
                        {primaryAction}
                    </div>
                )}
                {actions && (
                    <div className="flex shrink-0 items-center gap-2 [&>button]:relative [&>button]:m-0 [&>button]:h-10 [&>button]:min-h-10 [&>button]:w-10 [&>button]:min-w-10 [&>button]:shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {links && (
                <nav
                    aria-label="Business links"
                    data-chat-header-links
                    className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center justify-end md:col-span-1 md:col-start-2 md:row-start-1 md:max-w-80"
                >
                    {links}
                </nav>
            )}
        </header>
    )
}
