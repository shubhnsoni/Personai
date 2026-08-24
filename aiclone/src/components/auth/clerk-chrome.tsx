"use client"

import { useEffect } from "react"

/**
 * Hides Clerk's keyless-mode prompt.
 *
 * While the app runs on temporary API keys, Clerk injects a floating prompt into
 * #clerk-components. It overlaps the sign-in card's Continue button. Its wording
 * changes as setup progresses ("Configure your application", then "You've
 * created your first user"), so matching on text missed the later variants —
 * we key off the button's stable aria-label instead and fall back to text.
 *
 * Only the prompt's own wrapper is hidden, not the whole #clerk-components
 * container, because Clerk mounts its real modals in there too.
 */
const PROMPT_BUTTON = 'button[aria-label="Keyless prompt"]'

const TEXT_FALLBACK = [
    /configure your application/i,
    /temporary api keys/i,
    /created your first user/i,
    /claim (your )?application/i,
]

function hide(el: HTMLElement) {
    if (el.dataset.plHiddenClerk === "1") return
    el.style.setProperty("display", "none", "important")
    el.dataset.plHiddenClerk = "1"
}

/** The prompt's outermost wrapper below #clerk-components (or below body). */
function wrapperFor(button: Element): HTMLElement | null {
    let node = button.parentElement
    let last: HTMLElement | null = null
    while (node && node !== document.body && node.id !== "clerk-components") {
        last = node
        node = node.parentElement
    }
    return last
}

function hideKeylessPrompt() {
    for (const button of document.querySelectorAll(PROMPT_BUTTON)) {
        const wrapper = wrapperFor(button)
        if (wrapper) hide(wrapper)
    }

    // Fallback for builds where the aria-label changes: match the prompt by text,
    // but only among direct children of the Clerk portal so nothing else is hit.
    const portal = document.getElementById("clerk-components")
    if (!portal) return
    for (const child of portal.children) {
        if (!(child instanceof HTMLElement)) continue
        const text = child.innerText || ""
        if (!text) continue
        if (TEXT_FALLBACK.some((re) => re.test(text))) hide(child)
    }
}

export function ClerkChrome() {
    useEffect(() => {
        hideKeylessPrompt()
        const observer = new MutationObserver(() => hideKeylessPrompt())
        observer.observe(document.body, { childList: true, subtree: true })
        return () => observer.disconnect()
    }, [])
    return null
}
