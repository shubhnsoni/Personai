export const TRY_KITS = [
    { role: "SHOP", goal: "SELL_PRODUCTS", slug: "try-shop", name: "Shop", blurb: "Physical + digital. Stock, COD, AR.", next: "/dashboard/products" },
    { role: "RESTAURANT", goal: "BOOK_TABLE", slug: "try-restaurant", name: "Restaurant", blurb: "Menu, diet, tables, reserve.", next: "/dashboard/products" },
    { role: "CONSULTANT", goal: "TAKE_APPOINTMENTS", slug: "try-consultant", name: "Consultant", blurb: "Services + calendar. No shop.", next: "/dashboard/services" },
    { role: "CA", goal: "TAKE_APPOINTMENTS", slug: "try-ca", name: "CA / professional", blurb: "Sessions + UPI. No shop.", next: "/dashboard/services" },
    { role: "COACH", goal: "SELL_PRODUCTS", slug: "try-coach", name: "Coach", blurb: "Courses, sessions, digital shop.", next: "/dashboard/courses" },
    { role: "CREATOR", goal: "COLLECT_LEADS", slug: "try-creator", name: "Creator", blurb: "Digital shop + lead magnets.", next: "/dashboard/products" },
    { role: "DESIGNER", goal: "SHOW_PORTFOLIO", slug: "try-designer", name: "Designer", blurb: "Portfolio + chats + leads.", next: "/dashboard/profile" },
    { role: "DEVELOPER", goal: "SHOW_PORTFOLIO", slug: "try-developer", name: "Developer", blurb: "Same quiet kit as designer.", next: "/dashboard/profile" },
    { role: "EDITOR", goal: "SHOW_PORTFOLIO", slug: "try-editor", name: "Editor", blurb: "Portfolio only. No shop.", next: "/dashboard/profile" },
    { role: "JOB_SEEKER", goal: "HIRE_ME", slug: "try-job", name: "Job seeker", blurb: "Home, profile, chats, leads.", next: "/dashboard/profile" },
    { role: "CUSTOM", goal: "BOOK_CALL", slug: "try-custom", name: "Custom", blurb: "Every surface on.", next: "/dashboard" },
] as const

export type TryKit = (typeof TRY_KITS)[number]

export const ACTIVE_PROFILE_COOKIE = "pl-active-profile"
