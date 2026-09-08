"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false
const modes = ["light", "dark", "system"] as const

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
    const mode = mounted && modes.some(value => value === theme) ? theme : "system"
    const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor
    const label = mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System"

    return (
        <div className="mk-theme-toggle" title={`Color theme: ${label}`}>
            <Icon size={17} aria-hidden="true" />
            <select
                aria-label="Color theme"
                value={mode}
                disabled={!mounted}
                onChange={event => setTheme(event.target.value)}
            >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
            </select>
        </div>
    )
}
