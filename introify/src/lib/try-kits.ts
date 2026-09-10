import { resolveKitRole } from "@/lib/role-alias"

export const TRY_KITS = [
    { category: "new", role: "JEWELRY_RETAIL", goal: "SELL_PRODUCTS", slug: "try-jewelry-retail", name: "Jewellery store", blurb: "City gold board, weight × purity, making charges.", next: "/dashboard/products" },
    { category: "new", role: "JEWELRY_WHOLESALE", goal: "COLLECT_LEADS", slug: "try-gold-wholesale", name: "Gold wholesale", blurb: "70 touch in, 74 out, cash or udhar.", next: "/dashboard/products" },
    { category: "new", role: "DISTRIBUTOR", goal: "SELL_PRODUCTS", slug: "try-distributor", name: "Distributor", blurb: "Dealer orders, godown stock, warehouse, billing.", next: "/dashboard/orders" },
    { category: "new", role: "PHARMACY", goal: "SELL_PRODUCTS", slug: "try-pharmacy", name: "Pharmacy", blurb: "OTC + Rx medicines with batch, expiry, and prescriptions.", next: "/dashboard/products" },
    { category: "new", role: "AUTO_PARTS", goal: "SELL_PRODUCTS", slug: "try-auto-parts", name: "Auto parts", blurb: "Parts that fit a make, model, and year.", next: "/dashboard/products" },
    { category: "new", role: "FIELD_SERVICE", goal: "TAKE_APPOINTMENTS", slug: "try-field-service", name: "Field service", blurb: "Intake, dispatch, site visits, and inspections.", next: "/dashboard/services" },
    { category: "new", role: "SALON_SPA", goal: "TAKE_APPOINTMENTS", slug: "try-salon-spa", name: "Salon or spa", blurb: "Treatments, named staff, calendar, and retail.", next: "/dashboard/services" },
    { category: "new", role: "EVENTS_STUDIO", goal: "COLLECT_LEADS", slug: "try-events-studio", name: "Events studio", blurb: "Briefs, documents, approvals, and event delivery.", next: "/dashboard/events" },
    { category: "new", role: "REAL_ESTATE_BROKERAGE", goal: "COLLECT_LEADS", slug: "try-real-estate", name: "Real-estate brokerage", blurb: "Mandates, viewings, deal stages, and follow-up.", next: "/dashboard/leads" },
    { category: "new", role: "RECRUITMENT_AGENCY", goal: "COLLECT_LEADS", slug: "try-recruitment", name: "Recruitment agency", blurb: "Hiring briefs, candidates, interviews, and placement.", next: "/dashboard/leads" },
    { category: "more", role: "CAFE", goal: "BOOK_TABLE", slug: "try-cafe", name: "Cafe", blurb: "Drinks, snacks, and a few tables.", next: "/dashboard/products" },
    { category: "more", role: "CLOUD_KITCHEN", goal: "BOOK_TABLE", slug: "try-cloud-kitchen", name: "Cloud kitchen", blurb: "Menu and orders. No dining room.", next: "/dashboard/products" },
    { category: "more", role: "DHABA", goal: "BOOK_TABLE", slug: "try-dhaba", name: "Dhaba", blurb: "Highway kitchen. Menu, thalis, tables.", next: "/dashboard/products" },
    { category: "more", role: "CATERER", goal: "COLLECT_LEADS", slug: "try-caterer", name: "Caterer", blurb: "Menus, dates, and event delivery.", next: "/dashboard/events" },
    { category: "more", role: "KIRANA", goal: "SELL_PRODUCTS", slug: "try-kirana", name: "Kirana", blurb: "Neighbourhood grocery. Stock and pickup.", next: "/dashboard/products" },
    { category: "more", role: "BAKERY", goal: "SELL_PRODUCTS", slug: "try-bakery", name: "Bakery", blurb: "Cakes, bread, and counter orders.", next: "/dashboard/products" },
    { category: "more", role: "SWEETS", goal: "SELL_PRODUCTS", slug: "try-sweets", name: "Sweet shop", blurb: "Mithai boxes, kilos, festive trays.", next: "/dashboard/products" },
    { category: "more", role: "BOUTIQUE", goal: "SELL_PRODUCTS", slug: "try-boutique", name: "Boutique", blurb: "Apparel on the rack. Size and pickup.", next: "/dashboard/products" },
    { category: "more", role: "OPTICS", goal: "SELL_PRODUCTS", slug: "try-optics", name: "Optical store", blurb: "Frames, lenses, and eyewear stock.", next: "/dashboard/products" },
    { category: "more", role: "FLORIST", goal: "SELL_PRODUCTS", slug: "try-florist", name: "Florist", blurb: "Bouquets, bunches, same-day pickup.", next: "/dashboard/products" },
    { category: "more", role: "PRINT_SHOP", goal: "SELL_PRODUCTS", slug: "try-print-shop", name: "Print shop", blurb: "Prints, copies, and finishing.", next: "/dashboard/products" },
    { category: "more", role: "CLINIC", goal: "TAKE_APPOINTMENTS", slug: "try-clinic", name: "Clinic", blurb: "Front-desk booking only. No diagnosis.", next: "/dashboard/services" },
    { category: "more", role: "LAWYER", goal: "TAKE_APPOINTMENTS", slug: "try-lawyer", name: "Lawyer", blurb: "Consults, retainers, and case chats.", next: "/dashboard/services" },
    { category: "more", role: "INSURANCE", goal: "COLLECT_LEADS", slug: "try-insurance", name: "Insurance advisor", blurb: "Quotes, renewals, and booked reviews.", next: "/dashboard/leads" },
    { category: "more", role: "TUTOR", goal: "SELL_PRODUCTS", slug: "try-tutor", name: "Tutor", blurb: "Lessons, batches, and homework.", next: "/dashboard/courses" },
    { category: "more", role: "MUSIC_TEACHER", goal: "SELL_PRODUCTS", slug: "try-music-teacher", name: "Music teacher", blurb: "Classes, slots, and practice files.", next: "/dashboard/courses" },
    { category: "more", role: "GYM", goal: "TAKE_APPOINTMENTS", slug: "try-gym", name: "Gym", blurb: "Sessions, trainers, and retail.", next: "/dashboard/services" },
    { category: "more", role: "BARBER", goal: "TAKE_APPOINTMENTS", slug: "try-barber", name: "Barbershop", blurb: "Cuts, named chairs, walk-ins.", next: "/dashboard/services" },
    { category: "more", role: "YOGA", goal: "TAKE_APPOINTMENTS", slug: "try-yoga", name: "Yoga studio", blurb: "Classes, packs, and a small shop.", next: "/dashboard/services" },
    { category: "more", role: "PET_GROOMING", goal: "TAKE_APPOINTMENTS", slug: "try-pet-grooming", name: "Pet grooming", blurb: "Slots, pets, and add-on products.", next: "/dashboard/services" },
    { category: "more", role: "PLUMBER", goal: "TAKE_APPOINTMENTS", slug: "try-plumber", name: "Plumber", blurb: "Intake, visit, and a job card.", next: "/dashboard/services" },
    { category: "more", role: "ELECTRICIAN", goal: "TAKE_APPOINTMENTS", slug: "try-electrician", name: "Electrician", blurb: "Call-outs, quotes, and site visits.", next: "/dashboard/services" },
    { category: "more", role: "AC_REPAIR", goal: "TAKE_APPOINTMENTS", slug: "try-ac-repair", name: "AC & appliance", blurb: "Service visits, parts, and follow-up.", next: "/dashboard/services" },
    { category: "more", role: "GARAGE", goal: "TAKE_APPOINTMENTS", slug: "try-garage", name: "Garage", blurb: "Job cards, bays, and pickup.", next: "/dashboard/services" },
    { category: "more", role: "PHOTOGRAPHER", goal: "COLLECT_LEADS", slug: "try-photographer", name: "Photographer", blurb: "Briefs, dates, and galleries.", next: "/dashboard/events" },
    { category: "more", role: "TRAVEL", goal: "COLLECT_LEADS", slug: "try-travel", name: "Travel agent", blurb: "Itineraries, dates, and deposits.", next: "/dashboard/events" },
    { category: "more", role: "INTERIOR", goal: "SHOW_PORTFOLIO", slug: "try-interior", name: "Interior designer", blurb: "Projects, moodboards, and briefs.", next: "/dashboard/profile" },
    { category: "more", role: "AGENCY", goal: "COLLECT_LEADS", slug: "try-agency", name: "Agency", blurb: "Leads, retainers, and booked discovery.", next: "/dashboard/leads" },
    { category: "more", role: "NGO", goal: "COLLECT_LEADS", slug: "try-ngo", name: "NGO", blurb: "Programmes, sign-ups, and a guide.", next: "/dashboard/lead-magnets" },
    { category: "classic", role: "SHOP", goal: "SELL_PRODUCTS", slug: "try-shop", name: "Shop", blurb: "Physical + digital. Stock, COD, AR.", next: "/dashboard/products" },
    { category: "classic", role: "RESTAURANT", goal: "BOOK_TABLE", slug: "try-restaurant", name: "Restaurant", blurb: "Menu, diet, tables, reserve.", next: "/dashboard/products" },
    { category: "classic", role: "CONSULTANT", goal: "TAKE_APPOINTMENTS", slug: "try-consultant", name: "Consultant", blurb: "Services + calendar. No shop.", next: "/dashboard/services" },
    { category: "classic", role: "CA", goal: "TAKE_APPOINTMENTS", slug: "try-ca", name: "CA / professional", blurb: "Sessions + UPI. No shop.", next: "/dashboard/services" },
    { category: "classic", role: "COACH", goal: "SELL_PRODUCTS", slug: "try-coach", name: "Coach", blurb: "Courses, sessions, digital shop.", next: "/dashboard/courses" },
    { category: "classic", role: "CREATOR", goal: "COLLECT_LEADS", slug: "try-creator", name: "Creator", blurb: "Digital shop + lead magnets.", next: "/dashboard/products" },
    { category: "classic", role: "DESIGNER", goal: "SHOW_PORTFOLIO", slug: "try-designer", name: "Designer", blurb: "Portfolio + chats + leads.", next: "/dashboard/profile" },
    { category: "classic", role: "DEVELOPER", goal: "SHOW_PORTFOLIO", slug: "try-developer", name: "Developer", blurb: "Same quiet kit as designer.", next: "/dashboard/profile" },
    { category: "classic", role: "EDITOR", goal: "SHOW_PORTFOLIO", slug: "try-editor", name: "Editor", blurb: "Portfolio only. No shop.", next: "/dashboard/profile" },
    { category: "classic", role: "JOB_SEEKER", goal: "HIRE_ME", slug: "try-job", name: "Job seeker", blurb: "Home, profile, chats, leads.", next: "/dashboard/profile" },
    { category: "classic", role: "CUSTOM", goal: "BOOK_CALL", slug: "try-custom", name: "Custom", blurb: "Every surface on.", next: "/dashboard" },
] as const

export type TryKit = (typeof TRY_KITS)[number]

export type KitFamily = "shop" | "food" | "book" | "teach" | "studio"

export const KIT_FAMILIES: { id: KitFamily; label: string; hint: string }[] = [
    { id: "shop", label: "Shop", hint: "Products, stock, and pickup" },
    { id: "food", label: "Food", hint: "Menus, tables, and catering" },
    { id: "book", label: "Bookings", hint: "Time, visits, and treatments" },
    { id: "teach", label: "Teach", hint: "Courses and classes" },
    { id: "studio", label: "Studio", hint: "Portfolio, briefs, and pages" },
]

const FAMILY_BY_ENGINE: Record<string, KitFamily> = {
    SHOP: "shop",
    JEWELRY_RETAIL: "shop",
    JEWELRY_WHOLESALE: "shop",
    DISTRIBUTOR: "shop",
    PHARMACY: "shop",
    AUTO_PARTS: "shop",
    RESTAURANT: "food",
    CONSULTANT: "book",
    CA: "book",
    SALON_SPA: "book",
    FIELD_SERVICE: "book",
    COACH: "teach",
    CREATOR: "studio",
    DESIGNER: "studio",
    JOB_SEEKER: "studio",
    EVENTS_STUDIO: "studio",
    REAL_ESTATE_BROKERAGE: "studio",
    RECRUITMENT_AGENCY: "studio",
    CUSTOM: "studio",
}

export function tryKitByRole(role?: string | null) {
    if (!role) return undefined
    return TRY_KITS.find((k) => k.role === role)
}

/** Owner-facing grouping for the profile kit picker. Caterer stays with food even though the engine is events. */
export function kitFamily(role?: string | null): KitFamily {
    if (role === "CATERER") return "food"
    const engine = resolveKitRole(role) || role || ""
    return FAMILY_BY_ENGINE[engine] || "studio"
}

export const ACTIVE_PROFILE_COOKIE = "pl-active-profile"
export const TRY_NOW_COOKIE = "pl-try-now"
