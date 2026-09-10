import type { VenueBag } from "@/lib/venue"
import type { SocialLinks } from "@/lib/socials"
import type { Goal, RoleTemplate } from "@/lib/onboarding-needs"

export type DemoHour = {
    dayOfWeek: number
    startTime: string
    endTime: string
    isEnabled: boolean
}

export type DemoProduct = {
    title: string
    description: string
    category: string
    priceRupees: number
    compareAtRupees?: number
    sku?: string
    stock?: number
    thumbnailUrl?: string
    diet?: "VEG" | "NONVEG" | "VEGAN" | "JAIN"
    spiceLevel?: number
    serveWindow?: string
    prepMinutes?: number
    arKey?: string
    type?: "PHYSICAL" | "PDF" | "OTHER"
    fulfillment?: "PHYSICAL" | "DIGITAL"
    allowCod?: boolean
    shipMode?: "NONE" | "PICKUP" | "DELIVER" | "BOTH"
    highlights?: string[]
    body?: string
    weightGrams?: number
    variantsJson?: string
}

export type DemoService = {
    name: string
    description: string
    durationMinutes: number
    priceRupees: number
    kind?: "SESSION" | "TABLE"
    covers?: number
    isRecurring?: boolean
}

export type DemoStaff = {
    name: string
    kind?: "STAFF" | "ROOM" | "EQUIPMENT"
    capacity?: number
}

export type DemoStory = {
    url: string
    title: string
    body: string
    category: "AMBIENCE" | "INTERIOR" | "FOOD" | "TEAM" | "EVENT"
}

export type DemoDocument = {
    type: "BIO" | "FAQ" | "TEXT"
    title: string
    rawText: string
}

export type DemoExperience = {
    company: string
    role: string
    startDate: string
    endDate?: string | null
    description?: string
}

export type DemoProject = {
    title: string
    description: string
    year?: string
    imageUrl?: string
    client?: string
}

export type DemoCourse = {
    title: string
    description: string
    priceRupees: number
    thumbnailUrl?: string
    modules: { title: string; lessons: string[] }[]
}

export type DemoEvent = {
    title: string
    description: string
    daysFromNow: number
    durationHours: number
    location: string
    priceRupees: number
    thumbnailUrl?: string
}

export type DemoTableLayout = {
    zone: string
    prefix: string
    count: number
    seats: number
}

export type DemoShop = {
    flavor: string
    engine: RoleTemplate
    goal: Goal
    slug: string
    name: string
    headline: string
    bio: string
    welcome: string
    speakerName?: string
    speakerRole?: string
    whatsapp?: string
    upiId?: string
    gstin?: string
    deliveryNote?: string
    imageUrl?: string
    shopLogoUrl?: string
    venue: VenueBag
    socials?: SocialLinks
    googlePlaceId?: string
    hours: DemoHour[]
    tables?: DemoTableLayout[]
    products?: DemoProduct[]
    services?: DemoService[]
    staff?: DemoStaff[]
    story?: DemoStory[]
    documents: DemoDocument[]
    experiences?: DemoExperience[]
    projects?: DemoProject[]
    courses?: DemoCourse[]
    events?: DemoEvent[]
    leadMagnets?: { title: string; description: string }[]
    customInstructions: string
    tone?: "warm" | "calm" | "direct"
}

export function everydayHours(start: string, end: string): DemoHour[] {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: start,
        endTime: end,
        isEnabled: true,
    }))
}

export function weekdaysHours(start: string, end: string): DemoHour[] {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: start,
        endTime: end,
        isEnabled: dayOfWeek >= 1 && dayOfWeek <= 6,
    }))
}

export function rupees(n: number) {
    return Math.round(n * 100)
}
