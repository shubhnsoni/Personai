"use client"

import { useState } from "react"
import Link from "@/components/navigation/transition-link"
import { Instagram, Facebook, Youtube, MapPin, MessageCircle, Phone } from "lucide-react"
import { Syne, Fraunces } from "next/font/google"
import { toast } from "sonner"
import type { StoryFrame } from "@/lib/story"
import { aboutFooterCtas, waPrefill, type AboutFooterHrefKind } from "@/lib/kit-copy"
import { venueFromConfig, type VenueBag } from "@/lib/venue"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { whatsappHref } from "@/lib/commerce"
import { ModeToggle } from "@/components/mode-toggle"
import type { AboutWalkIn } from "@/lib/walk-in"
import type { SocialLinks } from "@/lib/socials"
import { cn } from "@/lib/utils"

const display = Syne({ subsets: ["latin"], weight: ["600", "700", "800"] })
const serif = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["italic", "normal"] })

function digitsOf(raw?: string | null) {
    return (raw || "").replace(/\D/g, "")
}

function prettyPhone(raw?: string | null) {
    const d = digitsOf(raw)
    if (!d) return null
    if (d.startsWith("91") && d.length >= 12) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
    if (d.length === 11 && d.startsWith("0")) return `+91 ${d.slice(1, 6)} ${d.slice(6)}`
    if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
    if (d.length >= 8) return `+${d}`
    return null
}

function telHref(raw?: string | null) {
    const d = digitsOf(raw)
    if (!d) return null
    if (d.length === 10) return `tel:+91${d}`
    if (d.length === 11 && d.startsWith("0")) return `tel:+91${d.slice(1)}`
    return `tel:+${d}`
}

function formattedAddress(venue?: VenueBag | null) {
    const formatted = venue?.address?.formatted
    return typeof formatted === "string" && formatted.trim() ? formatted.trim() : null
}

function addressLines(formatted: string) {
    const nl = formatted.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (nl.length > 1) return nl
    const parts = formatted.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) return [parts[0], parts.slice(1).join(", ")]
    return [formatted]
}

function venuePhone(venue?: VenueBag | null) {
    const phone = venue?.phone
    if (!phone) return { display: null as string | null, raw: null as string | null }
    const display = typeof phone.display === "string" && phone.display.trim() ? phone.display.trim() : null
    const raw = typeof phone.e164 === "string" && phone.e164.trim() ? phone.e164.trim() : display
    return { display, raw }
}

function hrefForKind(kind: AboutFooterHrefKind, slug: string) {
    switch (kind) {
        case "menu": return `/${slug}/menu`
        case "shop": return `/${slug}/shop`
        case "reserve": return `/${slug}/reserve`
        case "book": return `/${slug}/book`
        case "guide":
        case "tip":
        case "chat":
        default: return `/${slug}`
    }
}

function footerActions(role: string | null | undefined, slug: string) {
    const ctas = aboutFooterCtas(role)
    const lastKind = ctas.at(-1)?.hrefKind
    const primaryKind = lastKind === "chat" ? ctas[0]?.hrefKind : lastKind
    const primaryAt = ctas.findIndex((cta) => cta.hrefKind === primaryKind)
    return ctas.map((cta, i) => ({
        href: hrefForKind(cta.hrefKind, slug),
        label: cta.label,
        primary: i === primaryAt,
    }))
}

export function StoryMagazine({
    slug,
    name,
    headline,
    bio,
    role,
    logoUrl,
    whatsapp,
    frames: _frames,
    walkIn: _walkIn,
    socials,
    personalityConfig,
    hoursLabel,
    venue,
}: {
    slug: string
    name: string
    headline: string | null
    bio?: string | null
    role?: string | null
    logoUrl?: string | null
    whatsapp?: string | null
    frames: StoryFrame[]
    walkIn?: AboutWalkIn | null
    socials?: SocialLinks
    personalityConfig?: string | null
    hoursLabel?: string | null
    venue?: VenueBag | null
}) {
    const venueBag = venue || venueFromConfig(personalityConfig)
    const address = formattedAddress(venueBag)
    const fromVenue = venuePhone(venueBag)
    const phoneRaw = fromVenue.raw || whatsapp
    const phone = fromVenue.display || prettyPhone(phoneRaw)
    const tel = telHref(phoneRaw)
    const wa = whatsappHref(whatsapp || fromVenue.raw, waPrefill(role, name))
    const links = socials || {}
    const restaurant = role === "RESTAURANT"
    const actions = footerActions(role, slug)
    const paras = (bio || "").split(/\n+/).map((p) => p.trim()).filter(Boolean)
    const [copied, setCopied] = useState(false)

    async function share() {
        const url = window.location.href
        try {
            if (navigator.share) {
                await navigator.share({ title: name, url })
                return
            }
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success("Link copied")
        } catch {
            toast.error("Could not share")
        }
    }

    return (
        <div className={cn("about-landor min-h-dvh bg-[#eceae6] text-[#111]", display.className)}>
            <header className="sticky top-0 z-30 border-b border-black/10 bg-[#eceae6]/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
                    <Link href={restaurant ? `/${slug}/menu` : `/${slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : null}
                        <span className="truncate text-[13px] font-semibold tracking-tight">{name}</span>
                    </Link>
                    {phone && tel ? (
                        <a href={tel} className="hidden items-center gap-2 text-[13px] sm:flex">
                            <Phone className="h-4 w-4" />
                            {phone}
                        </a>
                    ) : null}
                    <button type="button" onClick={share} className="text-[12px] text-black/55">
                        {copied ? "Copied" : "Share"}
                    </button>
                    <ModeToggle />
                    <Link href={`/${slug}`} aria-label="Chat"><MessageCircle className="h-4 w-4" /></Link>
                </div>
            </header>

            <section className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center">
                <div className="mx-auto w-full max-w-[16rem] overflow-hidden rounded-full bg-[#d8d4cc] aspect-square">
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl font-semibold text-black/20">
                            {name.slice(0, 1)}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-black/45">About us</p>
                    <h1 className="mt-4 max-w-[16ch] text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
                        {name}
                    </h1>
                    {headline ? (
                        <p className={cn("mt-5 max-w-xl text-[1.15rem] leading-snug text-black/70", serif.className)}>
                            {headline}
                        </p>
                    ) : null}
                    {paras.slice(0, 2).map((p) => (
                        <p key={p.slice(0, 40)} className="mt-5 max-w-xl text-[15px] leading-relaxed text-black/65">
                            {p}
                        </p>
                    ))}
                    {wa || tel ? (
                        <a
                            href={wa || tel || `/${slug}`}
                            className="mt-8 inline-flex items-center gap-3 rounded-full border border-black/20 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.16em]"
                        >
                            Get in touch
                            <span aria-hidden>↗</span>
                        </a>
                    ) : null}
                </div>
            </section>

            <section className="mx-auto flex max-w-5xl flex-wrap justify-between gap-8 border-t border-black/10 px-5 py-10">
                {hoursLabel ? (
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Hours</p>
                        <p className="mt-2 text-lg font-medium">{hoursLabel}</p>
                    </div>
                ) : null}
                {address ? (
                    <div className="max-w-sm">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Visit</p>
                        <p className="mt-2 text-lg font-medium leading-snug">{address}</p>
                    </div>
                ) : null}
                {phone && tel ? (
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Call</p>
                        <a href={tel} className="mt-2 block text-lg font-medium">{phone}</a>
                    </div>
                ) : null}
            </section>

            <footer className="mx-auto max-w-5xl px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4">
                <div className="flex flex-wrap items-center gap-2">
                    {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-zinc-950" aria-label="WhatsApp">
                            <WhatsAppIcon className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.instagram ? (
                        <a href={links.instagram} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/5" aria-label="Instagram">
                            <Instagram className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.facebook ? (
                        <a href={links.facebook} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/5" aria-label="Facebook">
                            <Facebook className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.youtube ? (
                        <a href={links.youtube} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/5" aria-label="YouTube">
                            <Youtube className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.maps ? (
                        <a href={links.maps} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/5" aria-label="Maps">
                            <MapPin className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.zomato ? (
                        <a href={links.zomato} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full bg-black/5 px-4 text-[12px] font-medium">
                            Zomato
                        </a>
                    ) : null}
                </div>
                {actions.length ? (
                    <div className="mt-8 grid grid-cols-2 gap-2">
                        {actions.map((action) => (
                            <Link
                                key={action.href + action.label}
                                href={action.href}
                                className={cn(
                                    "rounded-full py-3 text-center text-[12px] font-semibold uppercase tracking-[0.18em]",
                                    action.primary
                                        ? "bg-[#111] text-white"
                                        : "border border-black/15 bg-transparent",
                                )}
                            >
                                {action.label}
                            </Link>
                        ))}
                    </div>
                ) : null}
            </footer>
        </div>
    )
}
