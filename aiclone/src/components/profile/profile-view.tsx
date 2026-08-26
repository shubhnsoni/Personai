"use client"

import { useState, useEffect } from "react"
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { ChatInterface, type ChatChip } from "@/components/chat/chat-interface"
import { ContentPanel } from "@/components/profile/content-panel"
import { BookingModal } from "@/components/booking/booking-modal"
import { ReserveSheet } from "@/components/booking/reserve-sheet"
import { isRestaurant } from "@/lib/menu"
import { extrasOf, publicChipAllowed } from "@/lib/surfaces"
import { CheckoutSheet, type CheckoutItem } from "@/components/checkout/checkout-sheet"
import { TipSheet } from "@/components/profile/tip-sheet"
import { X, Calendar, DollarSign, User, CheckCircle, Briefcase, FolderKanban, Gift, MessageCircle, GraduationCap, UsersRound } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { toast } from "sonner"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { Tracker, track } from "@/components/profile/tracker"

interface ProfileViewProps {
    profile: {
        id: string
        slug: string
        displayName: string
        headline: string | null
        bio: string | null
        welcomeMessageOverride: string | null
        contentDisplayMode: string
        roleTemplate?: string | null
        primaryGoal?: string | null
        personalityConfig?: string | null
        imageUrl?: string | null
        chatAvatarMode?: string | null
        workExperiences: Array<{
            id: string
            company: string
            role: string
            startDate: string
            endDate: string | null
            description: string | null
            achievements: string | null
        }>
        projects: Array<{
            id: string
            title: string
            description: string | null
            client: string | null
            year: string | null
            imageUrl: string | null
            link: string | null
        }>
        serviceOfferings: Array<{
            id: string
            name: string
            description: string | null
            priceCents: number
            isFree: boolean
            durationMinutes: number
            isActive: boolean
            kind?: string | null
            covers?: number | null
        }>
        whatsapp?: string | null
        upiId?: string | null
        gstin?: string | null
        digitalProducts?: Array<{
            id: string
            title: string
            description: string | null
            type: string
            priceCents: number
            thumbnailUrl?: string | null
            fulfillment?: string | null
            allowCod?: boolean
            stock?: number | null
            shipMode?: string | null
            shipFeeCents?: number
        }>
        courses?: Array<{
            id: string
            title: string
            description: string | null
            priceCents: number
            thumbnailUrl?: string | null
            modules: Array<{
                title?: string
                lessons: Array<{ title?: string; durationMinutes?: number; isFree?: boolean }>
            }>
        }>
        events?: Array<{
            id: string
            title: string
            description: string | null
            eventType: string
            startTime: string
            endTime: string
            priceCents: number
            isFree: boolean
            thumbnailUrl?: string | null
        }>
        communities?: Array<{
            id: string
            name: string
            description: string | null
            platform: string
            priceCents: number
            billingCycle: string
        }>
        leadMagnets?: Array<{
            id: string
            title: string
        }>
    }
    animationConfig: { speed?: number; intensity?: number; colors?: string[]; variant?: string; look?: string; skin?: string; shape?: string; expression?: string; color?: string }
    colors: string[]
}

type ContentType = "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities" | null

type ChipDef = ChatChip & { available: boolean }

export function ProfileView({ profile, animationConfig, colors }: ProfileViewProps) {
    const [activeContent, setActiveContent] = useState<ContentType>(null)
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<string | null>(null)
    const [checkoutItem, setCheckoutItem] = useState<CheckoutItem | null>(null)
    const [tipOpen, setTipOpen] = useState(false)
    const [showSuccessNotification, setShowSuccessNotification] = useState(false)
    const [introStage, setIntroStage] = useState<"hi" | "type" | "orb" | "ready">("hi")
    const searchParams = useSearchParams()

    useEffect(() => {
        const checkoutStatus = searchParams.get('checkout')
        if (checkoutStatus === 'success') {
            setShowSuccessNotification(true)
            const timer = setTimeout(() => {
                setShowSuccessNotification(false)
                window.history.replaceState({}, '', `/${profile.slug}`)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [searchParams, profile.slug])

    const handleShowContent = (type: Exclude<ContentType, null>) => {
        setActiveContent(type)
    }

    const handleBookService = (serviceId: string) => {
        setSelectedService(serviceId)
        setIsBookingOpen(true)
    }

    const handlePurchase = (itemType: string, itemId: string) => {
        const item = resolveCheckoutItem(profile, itemType, itemId)
        if (!item) {
            toast.error("That item is no longer available.")
            return
        }
        setCheckoutItem(item)
    }

    const chips = buildGoalChips(profile, {
        openBooking: () => setIsBookingOpen(true),
        openContent: (type) => setActiveContent(type),
        openTip: () => setTipOpen(true),
    }).map((chip) => ({
        ...chip,
        onSelect: () => {
            track(profile.slug, chip.id === "wa" ? "wa_tap" : "chip", { chip: chip.id })
            chip.onSelect?.()
        },
    }))
    const theme = ORB_THEMES[resolveOrbVariant(colors, animationConfig.variant)]

    return (
        <div
            className="flex h-screen w-full bg-profile text-profile-text overflow-hidden relative"
            style={{
                ["--pl-orb-from" as string]: theme.bright,
                ["--pl-orb-to" as string]: theme.deep,
                ["--pl-aurora" as string]: theme.accent,
                ["--pl-brand-foreground" as string]: theme.onAccent,
            }}
        >
            {showSuccessNotification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3 px-4 py-3 bg-green-600/90 text-white rounded-lg shadow-lg backdrop-blur-sm border border-green-500/30">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">You&apos;re in</p>
                            <p className="text-sm text-green-100">
                                Check your email, or <a href="/library/login" className="underline">open your library</a>.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowSuccessNotification(false)}
                            className="ml-2 p-1 hover:bg-green-500/50 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div
                className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-[1600ms] ease-out"
                style={{
                    opacity: introStage === "hi" || introStage === "type" ? 0 : 0.1,
                    background: `radial-gradient(circle at 30% 30%, ${theme.bright}, transparent 60%), radial-gradient(circle at 70% 70%, ${theme.deep}, transparent 60%)`
                }}
            />

            <div className="absolute right-3 top-3 z-30">
                <ModeToggle />
            </div>

            <Tracker slug={profile.slug} />
            <IntroVeil stage={introStage} />

            <div className="relative z-10 flex h-full min-w-0 w-full flex-1 flex-col">
                <div className="relative mx-auto h-full w-full flex-1 overflow-hidden">
                    <ChatInterface
                        profile={profile}
                        colors={colors}
                        animationConfig={animationConfig}
                        onShowContent={handleShowContent}
                        isPanelOpen={false}
                        chips={chips}
                        topics={welcomeTopics(profile)}
                        onIntroStage={setIntroStage}
                    />
                </div>
            </div>

            <ContentPanel
                isOpen={!!activeContent}
                onClose={() => setActiveContent(null)}
                type={activeContent}
                data={profile}
                onBookService={handleBookService}
                onPurchase={handlePurchase}
            />

            {profile.serviceOfferings.some((s) => s.kind === "TABLE") ? (
                <ReserveSheet
                    open={isBookingOpen}
                    onClose={() => {
                        setIsBookingOpen(false)
                        setSelectedService(null)
                    }}
                    profile={profile}
                    service={
                        profile.serviceOfferings.find((s) => s.id === selectedService && s.kind === "TABLE")
                        || profile.serviceOfferings.find((s) => s.kind === "TABLE")
                        || null
                    }
                />
            ) : (
                <BookingModal
                    isOpen={isBookingOpen}
                    onClose={() => {
                        setIsBookingOpen(false)
                        setSelectedService(null)
                    }}
                    profile={profile}
                    selectedServiceId={selectedService}
                />
            )}

            {checkoutItem && (
                <CheckoutSheet item={checkoutItem} onClose={() => setCheckoutItem(null)} />
            )}
            {tipOpen ? (
                <TipSheet
                    profileId={profile.id}
                    displayName={profile.displayName}
                    upiId={profile.upiId}
                    whatsapp={profile.whatsapp}
                    onClose={() => setTipOpen(false)}
                />
            ) : null}
        </div>
    )
}

function IntroVeil({ stage }: { stage: "hi" | "type" | "orb" | "ready" }) {
    const holeMv = useMotionValue(0)
    const veilOp = useMotionValue(1)
    const veilBg = useMotionTemplate`radial-gradient(circle at 50% 40%, transparent ${holeMv}%, #020308 calc(${holeMv}% + 36%))`

    useEffect(() => {
        const holeTo = stage === "hi" || stage === "type" ? 0 : stage === "orb" ? 36 : 130
        const opTo = stage === "ready" ? 0 : 1
        const h = animate(holeMv, holeTo, { duration: 1.6, ease: [0.16, 1, 0.3, 1] })
        const o = animate(veilOp, opTo, { duration: 1.6, ease: [0.22, 1, 0.36, 1] })
        return () => {
            h.stop()
            o.stop()
        }
    }, [stage, holeMv, veilOp])

    return (
        <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ opacity: veilOp, background: veilBg }}
        />
    )
}

function resolveCheckoutItem(
    profile: ProfileViewProps["profile"],
    itemType: string,
    itemId: string
): CheckoutItem | null {
    if (itemType === "product") {
        const p = profile.digitalProducts?.find((x) => x.id === itemId)
        return p
            ? {
                itemType: "product",
                itemId,
                title: p.title,
                priceCents: p.priceCents,
                description: p.description,
                fulfillment: p.fulfillment,
                allowCod: p.allowCod,
                upiId: profile.upiId,
                whatsapp: profile.whatsapp,
                shipMode: p.shipMode,
                shipFeeCents: p.shipFeeCents,
                gstin: profile.gstin,
                soldOut: p.stock != null && p.stock <= 0,
            }
            : null
    }
    if (itemType === "course") {
        const c = profile.courses?.find((x) => x.id === itemId)
        return c ? { itemType: "course", itemId, title: c.title, priceCents: c.priceCents, description: c.description } : null
    }
    if (itemType === "event") {
        const e = profile.events?.find((x) => x.id === itemId)
        return e ? { itemType: "event", itemId, title: e.title, priceCents: e.priceCents, description: e.description } : null
    }
    if (itemType === "community") {
        const c = profile.communities?.find((x) => x.id === itemId)
        return c ? { itemType: "community", itemId, title: c.name, priceCents: c.priceCents, description: c.description } : null
    }
    return null
}

function welcomeTopics(profile: ProfileViewProps["profile"]) {
    if (profile.roleTemplate === "RESTAURANT") {
        return ["the menu", "a table", "today's specials"]
    }
    const raw = [
        ...profile.serviceOfferings.filter((s) => s.isActive).map((s) => s.name),
        ...(profile.digitalProducts || []).map((p) => p.title),
        ...(profile.courses || []).map((c) => c.title),
        ...profile.projects.map((p) => p.title),
        ...(profile.events || []).map((e) => e.title),
    ]
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of raw) {
        const title = item.replace(/\s+/g, " ").trim()
        const key = title.toLowerCase()
        if (!title || title.length < 2 || /^project\s*\d*$/i.test(title) || seen.has(key)) continue
        seen.add(key)
        out.push(title.slice(0, 36))
        if (out.length >= 5) break
    }
    return out
}

function buildGoalChips(
    profile: ProfileViewProps["profile"],
    actions: {
        openBooking: () => void
        openContent: (type: Exclude<ContentType, null>) => void
        openTip: () => void
    }
): ChatChip[] {
    const name = profile.displayName
    const hasServices = profile.serviceOfferings.some(s => s.isActive)
    const hasProjects = profile.projects.length > 0
    const hasExperience = profile.workExperiences.length > 0
    const hasWork = hasProjects || hasExperience
    const hasLeadMagnets = (profile.leadMagnets?.length ?? 0) > 0

    const catalog: Record<string, ChipDef> = {
        book: {
            id: "book",
            label: profile.roleTemplate === "RESTAURANT" || profile.primaryGoal === "BOOK_TABLE" ? "Reserve a table" : "Book a call",
            available: hasServices,
            icon: <Calendar className="w-3.5 h-3.5" />,
            onSelect: actions.openBooking,
        },
        services: {
            id: "services",
            label: "See services",
            available: hasServices,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("services"),
        },
        rates: {
            id: "rates",
            label: "Ask about rates",
            available: hasServices,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            prompt: `What are ${name}'s rates?`,
        },
        work: {
            id: "work",
            label: "See work",
            available: hasWork,
            icon: <Briefcase className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent(hasProjects ? "projects" : "experience"),
        },
        portfolio: {
            id: "portfolio",
            label: "See portfolio",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("projects"),
        },
        history: {
            id: "history",
            label: "Work history",
            available: hasExperience,
            icon: <Briefcase className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("experience"),
        },
        projects: {
            id: "projects",
            label: "See projects",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("projects"),
        },
        cases: {
            id: "cases",
            label: "Case studies",
            available: hasProjects,
            icon: <FolderKanban className="w-3.5 h-3.5" />,
            prompt: "Walk me through a case study",
        },
        about: {
            id: "about",
            label: "About",
            available: true,
            icon: <User className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("about"),
        },
        guide: {
            id: "guide",
            label: "Get the free guide",
            available: hasLeadMagnets,
            icon: <Gift className="w-3.5 h-3.5" />,
            prompt: "How can I get the free guide?",
        },
        ask: {
            id: "ask",
            label: "Ask a question",
            available: true,
            icon: <MessageCircle className="w-3.5 h-3.5" />,
        },
        products: {
            id: "products",
            label: "Shop",
            available: profile.roleTemplate !== "RESTAURANT" && (profile.digitalProducts?.length ?? 0) > 0,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("products"),
        },
        shop: {
            id: "shop",
            label: profile.roleTemplate === "RESTAURANT" ? "Menu" : "Open shop",
            available: (profile.digitalProducts?.length ?? 0) > 0,
            icon: <DollarSign className="w-3.5 h-3.5" />,
            href: profile.roleTemplate === "RESTAURANT" ? `/${profile.slug}/menu` : `/${profile.slug}/shop`,
        },
        wa: {
            id: "wa",
            label: "WhatsApp",
            available: Boolean(profile.whatsapp),
            icon: <MessageCircle className="w-3.5 h-3.5" />,
            href: profile.whatsapp
                ? `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${profile.displayName}`)}`
                : undefined,
        },
        tip: {
            id: "tip",
            label: "Send a tip",
            available: Boolean(profile.upiId || profile.whatsapp),
            icon: <Gift className="w-3.5 h-3.5" />,
            onSelect: actions.openTip,
        },
        courses: {
            id: "courses",
            label: "Courses",
            available: (profile.courses?.length ?? 0) > 0,
            icon: <GraduationCap className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("courses"),
        },
        events: {
            id: "events",
            label: "Events",
            available: (profile.events?.length ?? 0) > 0,
            icon: <Calendar className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("events"),
        },
        communities: {
            id: "communities",
            label: "Community",
            available: (profile.communities?.length ?? 0) > 0,
            icon: <UsersRound className="w-3.5 h-3.5" />,
            onSelect: () => actions.openContent("communities"),
        },
    }

    const orderByGoal: Record<string, string[]> = {
        BOOK_CALL: ["book", "services", "rates", "work"],
        HIRE_ME: ["portfolio", "history", "rates", "book"],
        SHOW_PORTFOLIO: ["projects", "cases", "about", "book"],
        SHOWCASE_WORK: ["projects", "cases", "about", "book"],
        COLLECT_LEADS: ["guide", "ask", "work", "book"],
        SELL_PRODUCTS: ["products", "shop", "wa", "tip"],
        TAKE_APPOINTMENTS: ["book", "services", "rates", "about"],
        BOOK_TABLE: ["shop", "book", "wa"],
    }

    const goal = profile.primaryGoal || "BOOK_CALL"
    const keys = orderByGoal[goal] ?? ["about", "work", "services", "book"]
    const extraKeys = profile.roleTemplate === "RESTAURANT"
        ? ["wa", "tip"]
        : ["products", "shop", "wa", "tip", "courses", "events", "communities"]
    const extras = extraKeys.filter((k) => !keys.includes(k))
    const allowed = [...keys, ...extras].filter((k) => publicChipAllowed(profile.roleTemplate, k, extrasOf(profile)))
    const chips = allowed
        .map((key) => catalog[key])
        .filter((chip): chip is ChipDef => Boolean(chip?.available))
        .map(({ available: _available, ...chip }) => chip)

    if (chips.length === 0) {
        const { available: _available, ...about } = catalog.about
        chips.push(about)
    }
    if (chips[0]) chips[0] = { ...chips[0], highlighted: true }
    return chips
}
