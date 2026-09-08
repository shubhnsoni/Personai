"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Instagram, Facebook, Youtube, MapPin, MessageCircle, Phone } from "lucide-react"
import { motion } from "framer-motion"
import { Syne, Fraunces } from "next/font/google"
import { toast } from "sonner"
import { storyCategoryLabel, type StoryFrame } from "@/lib/story"
import { aboutFooterCtas, waPrefill, type AboutFooterHrefKind } from "@/lib/kit-copy"
import { venueFromConfig, type VenueBag } from "@/lib/venue"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { whatsappHref } from "@/lib/commerce"
import { ModeToggle } from "@/components/mode-toggle"
import { WalkInStage } from "@/components/profile/walk-in-stage"
import { GooglePlacePanel } from "@/components/profile/google-place-panel"
import { StoryGallery } from "@/components/shop/story-gallery"
import type { AboutWalkIn } from "@/lib/walk-in"
import type { SocialLinks } from "@/lib/socials"
import type { ItemPhoto } from "@/lib/item-photos"
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
    frames,
    walkIn,
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
    const cover = frames[0]
    const groups = useMemo(() => {
        const rest = frames
        const order: string[] = []
        const by = new Map<string, StoryFrame[]>()
        for (const frame of rest) {
            const key = frame.category || "AMBIENCE"
            if (!by.has(key)) {
                order.push(key)
                by.set(key, [])
            }
            by.get(key)!.push(frame)
        }
        return order.map((category) => ({ category, frames: by.get(category) || [] }))
    }, [frames])
    const photos = useMemo(() => frames.map((frame) => frame.url).filter(Boolean), [frames])
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
        <div className={cn("min-h-dvh bg-[#0c0b0a] text-[#f4efe6]", display.className)}>
            <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-[2px]">
                <Link href={restaurant ? `/${slug}/menu` : `/${slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {logoUrl ? <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : null}
                    <span className="truncate text-[12px] font-semibold tracking-[0.18em] uppercase">{name}</span>
                </Link>
                <button type="button" onClick={share} className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    {copied ? "Copied" : "Share"}
                </button>
                <ModeToggle />
                <Link href={`/${slug}`} aria-label="Chat"><MessageCircle className="h-4 w-4" /></Link>
            </header>

            <section className="relative h-[100dvh] min-h-[32rem] overflow-hidden">
                {cover?.url ? (
                    <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-[#161410]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0b0a] via-[#0c0b0a]/25 to-black/20" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-10">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] uppercase tracking-[0.36em] text-[#00D7FF]"
                    >
                        About
                    </motion.p>
                    <motion.h1
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-2 max-w-[12ch] text-[3.1rem] font-extrabold leading-[0.9] tracking-[-0.05em] sm:text-7xl"
                    >
                        {name}
                    </motion.h1>
                    {headline ? (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.28 }}
                            className={cn("mt-4 max-w-sm text-[1.05rem] leading-snug text-[#f4efe6]/85", serif.className)}
                        >
                            {headline}
                        </motion.p>
                    ) : null}
                </div>
            </section>

            <section className="px-4 py-10">
                <div className="mb-3 flex items-end justify-between">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-[#00D7FF]">Step inside</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Drag</p>
                </div>
                <div className="overflow-hidden rounded-[1.75rem] ring-1 ring-white/12">
                    <div className="relative h-[62dvh] min-h-[22rem] bg-black">
                        <WalkInStage walkIn={walkIn} photos={photos} className="h-full w-full" />
                    </div>
                </div>
            </section>

            {links.maps ? (
                <section className="px-4 pb-2 pt-2">
                    <GooglePlacePanel
                        slug={slug}
                        mapsUrl={links.maps}
                        photos={photos.map((url) => ({ url, source: "google" as const }))}
                    />
                </section>
            ) : null}

            {paras.length ? (
                <section className="space-y-7 px-5 py-8">
                    {paras.map((p, i) => (
                        <motion.p
                            key={p.slice(0, 40)}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-12%" }}
                            transition={{ duration: 0.7 }}
                            className={cn(i === 0 ? "text-[1.35rem] leading-snug" : "text-[15px] leading-relaxed text-zinc-400", i === 0 && serif.className)}
                        >
                            {p}
                        </motion.p>
                    ))}
                </section>
            ) : null}

            {groups.map((group, gi) => {
                const stack: ItemPhoto[] = group.frames.map((frame) => ({ url: frame.url, source: "owner" as const }))
                const lead = group.frames[0]
                return (
                    <section key={group.category} className="space-y-4 py-8">
                        <p className="px-5 text-[10px] uppercase tracking-[0.32em] text-[#00D7FF]">
                            {String(gi + 1).padStart(2, "0")} {storyCategoryLabel(role, group.category)}
                        </p>
                        <div className="px-4">
                            <StoryGallery
                                photos={stack}
                                title={lead?.title || name}
                                labels={{ owner: "About" }}
                            />
                        </div>
                        {lead && (lead.title || lead.body) ? (
                            <div className="px-5">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                    {storyCategoryLabel(role, group.category)}
                                </p>
                                {lead.title ? <h2 className="mt-1 text-2xl font-semibold tracking-tight">{lead.title}</h2> : null}
                                {lead.body ? (
                                    <p className={cn("mt-1 max-w-sm text-[15px] leading-relaxed text-zinc-400", serif.className)}>
                                        {lead.body}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        {group.frames.slice(1).filter((f) => f.title || f.body).length ? (
                            <ul className="space-y-2 px-5 text-sm text-zinc-300">
                                {group.frames.slice(1).map((frame) => (
                                    frame.title ? (
                                        <li key={frame.id} className="flex gap-2">
                                            <span className="text-emerald-400">✓</span>
                                            <span>
                                                <span className="font-medium text-zinc-100">{frame.title}</span>
                                                {frame.body ? <span className="text-zinc-400"> — {frame.body}</span> : null}
                                            </span>
                                        </li>
                                    ) : null
                                ))}
                            </ul>
                        ) : null}
                    </section>
                )
            })}

            <footer className="mt-10 border-t border-white/10 bg-white/[0.03] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#00D7FF]">Visit</p>
                {address ? (
                    <p className="mt-3 text-3xl font-extrabold leading-[0.9] tracking-tight">
                        {addressLines(address).map((line, i) => (
                            <span key={line}>
                                {i > 0 ? <br /> : null}
                                {line}
                            </span>
                        ))}
                    </p>
                ) : null}
                {phone && tel ? (
                    <a href={tel} className="mt-6 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Phone className="h-5 w-5 text-[#00D7FF]" />
                        {phone}
                    </a>
                ) : null}
                {hoursLabel ? (
                    <p className={cn("mt-3 text-sm text-zinc-500", serif.className)}>{hoursLabel}</p>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                    {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-zinc-950" aria-label="WhatsApp">
                            <WhatsAppIcon className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.instagram ? (
                        <a href={links.instagram} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-label="Instagram">
                            <Instagram className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.facebook ? (
                        <a href={links.facebook} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-label="Facebook">
                            <Facebook className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.youtube ? (
                        <a href={links.youtube} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-label="YouTube">
                            <Youtube className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.maps ? (
                        <a href={links.maps} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-label="Maps">
                            <MapPin className="h-5 w-5" />
                        </a>
                    ) : null}
                    {links.zomato ? (
                        <a href={links.zomato} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-[12px] font-medium backdrop-blur-md">
                            Zomato
                        </a>
                    ) : null}
                </div>
                {actions.length > 1 ? (
                    <div className="mt-8 grid grid-cols-2 gap-2">
                        {actions.map((action) => (
                            <Link
                                key={action.href + action.label}
                                href={action.href}
                                className={cn(
                                    "rounded-full py-3 text-center text-[12px] font-semibold uppercase tracking-[0.18em]",
                                    action.primary
                                        ? "bg-[#00D7FF] text-zinc-950"
                                        : "border border-white/20 bg-white/10 backdrop-blur-md",
                                )}
                            >
                                {action.label}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <Link
                        href={actions[0].href}
                        className="mt-8 block rounded-full bg-white py-3 text-center text-sm font-semibold text-zinc-950"
                    >
                        {actions[0].label}
                    </Link>
                )}
            </footer>
        </div>
    )
}
