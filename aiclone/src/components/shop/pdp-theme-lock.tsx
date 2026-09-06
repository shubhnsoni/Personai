"use client"

import { useEffect } from "react"

/** Keep the public PDP on fog/white even if the site theme is dark. */
export function PdpThemeLock() {
    useEffect(() => {
        const html = document.documentElement
        const body = document.body
        const htmlClass = html.className
        const bodyBg = body.style.backgroundColor
        const bodyColor = body.style.color
        html.classList.remove("dark")
        html.classList.add("light")
        body.style.backgroundColor = "#f4f6f8"
        body.style.color = "#0b1220"
        return () => {
            html.className = htmlClass
            body.style.backgroundColor = bodyBg
            body.style.color = bodyColor
        }
    }, [])
    return null
}
