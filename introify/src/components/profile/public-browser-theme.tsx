"use client"

import { useEffect, type RefObject } from "react"
import { useTheme } from "next-themes"
import { BLOUB_THEME_META, type BloubThemeId } from "@/lib/bloub/catalog"

/** Keep browser chrome and the page canvas on the selected business palette. */
export function PublicBrowserTheme({ active, theme, frameRef }: {
    active: boolean
    theme: string
    frameRef: RefObject<HTMLElement | null>
}) {
    const { resolvedTheme, forcedTheme } = useTheme()

    useEffect(() => {
        const frame = frameRef.current
        if (!active || !frame) return

        const root = document.documentElement
        const restore: Array<() => void> = []
        const ownProperty = (element: HTMLElement, property: string) => {
            const previous = element.style.getPropertyValue(property)
            const priority = element.style.getPropertyPriority(property)
            let applied: string | undefined
            restore.push(() => {
                // A newer page or theme owner may already have replaced our value.
                if (applied === undefined || element.style.getPropertyValue(property) !== applied) return
                if (previous) element.style.setProperty(property, previous, priority)
                else element.style.removeProperty(property)
            })
            return (value: string) => {
                element.style.setProperty(property, value)
                applied = element.style.getPropertyValue(property)
            }
        }

        // Safari can sample the page background, including areas outside the visual viewport.
        const paintRoot = ownProperty(root, "background-color")
        const paintBody = ownProperty(document.body, "background-color")
        const paintScheme = ownProperty(document.body, "color-scheme")
        // next-themes owns the root's inline color-scheme; leave it intact across navigation.

        const themeMeta = document.createElement("meta")
        themeMeta.name = "theme-color"
        themeMeta.dataset.publicBrowserTheme = ""
        const schemeMeta = document.createElement("meta")
        schemeMeta.name = "color-scheme"
        schemeMeta.dataset.publicBrowserTheme = ""

        const refresh = () => {
            const selected = forcedTheme || resolvedTheme
            const mode = selected === "dark" || (!selected && root.classList.contains("dark")) ? "dark" : "light"
            const canvas = BLOUB_THEME_META[theme as BloubThemeId]?.canvas
            const color = canvas
                ? canvas[mode]
                : getComputedStyle(frame).getPropertyValue("--profile-bg").trim()
            if (!color) return

            paintRoot(color)
            paintBody(color)
            paintScheme(mode)
            themeMeta.content = color
            schemeMeta.content = mode
            // An explicit in-app choice must take precedence over the root's OS media-query tags.
            // Own separate tags so cleanup never restores stale Next.js metadata over a new route.
            if (!themeMeta.isConnected) document.head.prepend(themeMeta, schemeMeta)
        }

        // A child's effect can run before next-themes applies its root class. Re-read CSS after
        // that class changes; observing style too would feed our own canvas painting back here.
        const observer = new MutationObserver(refresh)
        observer.observe(root, { attributes: true, attributeFilter: ["class"] })
        refresh()

        return () => {
            observer.disconnect()
            themeMeta.remove()
            schemeMeta.remove()
            restore.reverse().forEach(reset => reset())
        }
    }, [active, theme, resolvedTheme, forcedTheme, frameRef])

    return null
}
