import type { ImportSourceKind } from "@/lib/import-extract"

export type SourceHint = "auto" | "cv" | "site" | "shop" | "course" | "events" | "services"

export function classifyFile(name: string, mime = ""): ImportSourceKind | "docx" {
    const n = name.toLowerCase()
    if (n.endsWith(".ics") || mime.includes("calendar")) return "ics"
    if (n.endsWith(".csv") || mime.includes("csv")) return "csv"
    if (n.endsWith(".pdf") || mime.includes("pdf")) return "pdf"
    if (n.endsWith(".doc") || n.endsWith(".docx")) return "docx"
    return "text"
}

export function classifyUrl(url: string): ImportSourceKind {
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return "youtube"
    return "url"
}

export function hintLabel(hint: SourceHint) {
    switch (hint) {
        case "cv": return "You"
        case "site": return "Site"
        case "shop": return "Shop"
        case "course": return "Courses"
        case "events": return "Events"
        case "services": return "Services"
        default: return "Anything"
    }
}

export function acceptForHint(hint: SourceHint) {
    if (hint === "events") return ".ics,.csv,text/calendar,text/csv"
    if (hint === "cv") return ".pdf,.txt,.md,.csv,application/pdf,text/plain"
    if (hint === "shop") return ".csv,.txt,.md,text/csv,text/plain"
    if (hint === "course") return ".txt,.md,.csv,text/plain"
    return ".pdf,.txt,.md,.csv,.ics,application/pdf,text/plain,text/csv,text/calendar"
}

export function placeholderForHint(hint: SourceHint) {
    switch (hint) {
        case "cv":
            return "Paste a CV, about page, or https://…"
        case "shop":
            return "https://www.swiggy.com/…\nhttps://www.zomato.com/…\nhttps://www.ubereats.com/…\nor paste dishes: Paneer tikka, 220, Starters, Veg"
        case "course":
            return "Module: Cadence\n- Weekly stack (12m, free)\nor a course URL"
        case "events":
            return "Launch workshop, 2026-09-04 18:00\nor drop an .ics"
        case "services":
            return "Strategy call, 150\nSprint, 900"
        case "site":
            return "https://yoursite.com/about"
        default:
            return "Paste a link, list, or CV…"
    }
}
