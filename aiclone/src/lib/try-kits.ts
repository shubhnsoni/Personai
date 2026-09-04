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

export const ACTIVE_PROFILE_COOKIE = "pl-active-profile"
export const TRY_NOW_COOKIE = "pl-try-now"
