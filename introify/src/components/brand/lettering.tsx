"use client"

import { useId } from "react"
import artwork from "./lettering-data.json"

/** Outlined lettering keeps the ribbon join identical across browsers. */
export function IntroifyLettering() {
    const id = useId().replace(/:/g, "")
    const accent = "var(--brand-accent, #0073D5)"
    return (
        <g className="text-[#111111] dark:text-[#fdfdfd] [.auth-scene_&]:text-[#fdfdfd]">
            <defs>
                <linearGradient id={`${id}-o`} x1="390" y1="70" x2="451" y2="154" gradientUnits="userSpaceOnUse">
                    <stop offset=".35" stopColor="currentColor" />
                    <stop offset=".7" stopColor="#343434" className="dark:[stop-color:#b8b8b8] [.auth-scene_&]:[stop-color:#b8b8b8]" />
                    <stop offset="1" stopColor="#626262" />
                </linearGradient>
                <linearGradient id={`${id}-join`} x1="407" y1="158" x2="495" y2="100" gradientUnits="userSpaceOnUse">
                    <stop stopColor="currentColor" />
                    <stop offset=".5" stopColor="#31576e" className="dark:[stop-color:#72f4ed] [.auth-scene_&]:[stop-color:#72f4ed]" />
                    <stop offset="1" stopColor={accent} />
                </linearGradient>
            </defs>
            {artwork.ntr.map((d, index) => <path key={index} d={d} fill="currentColor" />)}
            <path d={artwork.o} fill={`url(#${id}-o)`} fillRule="evenodd" />
            <path d={artwork.i} fill={accent} />
            <circle cx="492.5" cy="32" r="17.5" fill={accent} />
            <path d={artwork.f} fill={accent} />
            <path d={artwork.y} fill={accent} />
            <path d={artwork.bridge} fill={`url(#${id}-join)`} />
        </g>
    )
}
