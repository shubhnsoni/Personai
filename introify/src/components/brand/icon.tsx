"use client"

import { useId } from "react"
import { SelectedBrand } from "./selected-brand"
import motion from "./motion-data.json"

interface IntroifyIconProps {
    className?: string
    decorative?: boolean
    animated?: boolean
}

/** Vector interpretation of the supplied flowing person / lowercase-i symbol. */
export function IntroifyIconArtwork({ animated = true }: { animated?: boolean } = {}) {
    const gradientId = `introify-symbol-${useId().replace(/:/g, "")}`
    const blurId = `${gradientId}-blur`
    const ribbonId = `${gradientId}-ribbon`
    const animate = (attributeName: string, values: string) => (
        <animate attributeName={attributeName} values={values} keyTimes={motion.keyTimes}
            dur={`${motion.duration}s`} repeatCount="indefinite" calcMode="linear" />
    )

    return (
        <>
            {animated && <style>{`.introify-motion-still{display:none}@media(prefers-reduced-motion:reduce){.introify-motion{display:none}.introify-motion-still{display:inline}}`}</style>}
            <defs>
                <linearGradient id={gradientId} x1="20" y1="65" x2="145" y2="113" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#20E3BA" className="dark:[stop-color:#5EF3D2] [.auth-scene_&]:[stop-color:#5EF3D2]" />
                    <stop offset="0.32" stopColor="#00C7E8" className="dark:[stop-color:#31DFFF] [.auth-scene_&]:[stop-color:#31DFFF]" />
                    <stop offset="0.64" stopColor="#0073D5" className="dark:[stop-color:#329EFF] [.auth-scene_&]:[stop-color:#329EFF]" />
                    <stop offset="1" stopColor="#142A98" className="dark:[stop-color:#5879F5] [.auth-scene_&]:[stop-color:#5879F5]" />
                </linearGradient>
                {animated && <linearGradient id={ribbonId} gradientUnits="userSpaceOnUse" x1="24" y1="139" x2="148" y2="61">
                    <stop stopColor="#087BFF" />
                    <stop offset=".48" stopColor="#08BFEC" />
                    <stop offset=".82" stopColor="#6CECC3" />
                    <stop offset="1" stopColor="#C6FBE0" />
                </linearGradient>}
                {animated && <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>}
            </defs>
            {animated && <g className="introify-motion" fill={`url(#${gradientId})`}>
                <path d="M115 72Z" opacity="0" filter={`url(#${blurId})`}>
                    {animate("d", motion.trail)}{animate("opacity", motion.trailOpacity)}
                </path>
                <path d={motion.ring.split(";")[40]} fill={`url(#${ribbonId})`} opacity="0">
                    {animate("d", motion.ring)}{animate("opacity", motion.ringOpacity)}
                </path>
                <path d={motion.body.split(";")[60]}>
                    {animate("d", motion.body)}{animate("opacity", motion.opacity)}
                </path>
                <ellipse cx="133" cy="49" rx="19" ry="19">
                    {animate("cx", motion.x)}{animate("cy", motion.y)}
                    {animate("rx", motion.rx)}{animate("ry", motion.ry)}
                </ellipse>
            </g>}
            <g className={animated ? "introify-motion-still" : undefined} fill={`url(#${gradientId})`}>
                <circle cx="133" cy="49" r="19" />
                <path d="M14 120C25 94 41 86 60 95C78 103 91 100 110 86C127 73 143 69 150 77C159 88 145 121 129 137C114 152 96 156 80 145C63 134 53 115 39 112C30 110 21 115 14 120Z" />
            </g>
        </>
    )
}

export function IntroifyIcon(props: IntroifyIconProps) {
    return <SelectedBrand {...props} symbol />
}
