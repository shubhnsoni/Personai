"use client"

import NextLink from "next/link"
import type { ComponentProps } from "react"
import { usePageTransition } from "./page-transition"

type Props = ComponentProps<typeof NextLink>

/** Keeps Next's prefetch, refs, modifier keys and native link behavior intact. */
export default function TransitionLink({ onNavigate, ...props }: Props) {
    const start = usePageTransition()
    return (
        <NextLink {...props} onNavigate={(event) => {
            let canceled = false
            onNavigate?.({ preventDefault: () => { canceled = true; event.preventDefault() } })
            if (canceled) return
            const destination = props.as ?? props.href
            const href = typeof destination === "string" ? destination : destination.pathname
            if (href) start(href)
        }} />
    )
}
