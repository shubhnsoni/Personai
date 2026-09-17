"use client"

import { useEffect, useRef } from "react"
import { adoptOwnedTryKit } from "@/app/actions/try-kits"

/** Signed-in owners visiting /try-* keep that kit as the dashboard business. Guests never mount this. */
export function AdoptOwnedTryKit({ slug }: { slug: string }) {
    const once = useRef(false)
    useEffect(() => {
        if (once.current) return
        once.current = true
        void adoptOwnedTryKit(slug)
    }, [slug])
    return null
}
