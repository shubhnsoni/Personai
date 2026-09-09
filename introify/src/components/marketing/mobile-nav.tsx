"use client"

import Link from "@/components/navigation/transition-link"
import { useRef } from "react"

export function MobileNav({ links }: { links: readonly (readonly [string, string])[] }) {
    const details = useRef<HTMLDetailsElement>(null)
    const summary = useRef<HTMLElement>(null)

    function close() {
        if (details.current) details.current.open = false
    }

    return (
        <details
            ref={details}
            className="mk-mobile-menu"
            onKeyDown={event => {
                if (event.key === "Escape" && details.current?.open) {
                    event.preventDefault()
                    close()
                    summary.current?.focus()
                }
            }}
        >
            <summary ref={summary} aria-label="Navigation menu">
                <span />
                <span />
            </summary>
            <nav aria-label="Mobile navigation">
                {links.map(([label, href]) => (
                    <Link key={label} href={href} onClick={close}>{label}</Link>
                ))}
                <Link href="/sign-up" onClick={close}>Get started</Link>
                <Link href="/sign-in" onClick={close}>Sign in</Link>
            </nav>
        </details>
    )
}
