"use client"

import { useEffect } from "react"

function hideKeyless() {
    const match = (text: string) =>
        /configure your application/i.test(text) && /temporary api keys/i.test(text)

    for (const el of document.querySelectorAll<HTMLElement>("body > div, body > aside, body > section")) {
        if (match(el.innerText || "")) {
            el.style.setProperty("display", "none", "important")
            el.setAttribute("data-pl-hidden-clerk", "1")
        }
    }
}

export function ClerkChrome() {
    useEffect(() => {
        hideKeyless()
        const obs = new MutationObserver(() => hideKeyless())
        obs.observe(document.body, { childList: true, subtree: true })
        return () => obs.disconnect()
    }, [])
    return null
}
