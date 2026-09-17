export type HousekeepingCatalogueItem = {
    sku: string
    label: string
    department: "HOUSEKEEPING"
    aliases: string[]
}

export const DEFAULT_HOUSEKEEPING_CATALOGUE: HousekeepingCatalogueItem[] = [
    { sku: "towels", label: "Towels", department: "HOUSEKEEPING", aliases: ["towel", "towels", "bath towel"] },
    { sku: "water", label: "Bottled water", department: "HOUSEKEEPING", aliases: ["water", "bottle", "bottled water"] },
    { sku: "toiletries", label: "Toiletries", department: "HOUSEKEEPING", aliases: ["toiletries", "shampoo", "soap", "toothbrush"] },
    { sku: "pillows", label: "Extra pillows", department: "HOUSEKEEPING", aliases: ["pillow", "pillows"] },
    { sku: "blankets", label: "Extra blankets", department: "HOUSEKEEPING", aliases: ["blanket", "blankets", "duvet"] },
    { sku: "slippers", label: "Slippers", department: "HOUSEKEEPING", aliases: ["slipper", "slippers"] },
    { sku: "cleaning", label: "Room cleaning", department: "HOUSEKEEPING", aliases: ["clean", "cleaning", "housekeeping", "make up the room"] },
]

export function defaultHousekeepingCatalogue() {
    return DEFAULT_HOUSEKEEPING_CATALOGUE.map((item) => ({ sku: item.sku, label: item.label, department: item.department }))
}

export type SpaCatalogueItem = {
    sku: string
    label: string
    durationMinutes: number
    aliases: string[]
}

export const DEFAULT_SPA_CATALOGUE: SpaCatalogueItem[] = [
    { sku: "massage", label: "Hinoo massage", durationMinutes: 60, aliases: ["60 minute massage", "60-minute massage", "spa massage", "massage"] },
    { sku: "steam-scrub", label: "Steam and scrub", durationMinutes: 45, aliases: ["steam and scrub", "steam & scrub", "scrub", "steam"] },
    { sku: "hot-stone", label: "Hot stone", durationMinutes: 75, aliases: ["hot stone", "hot-stone", "stone massage"] },
]

export function defaultSpaCatalogue() {
    return DEFAULT_SPA_CATALOGUE.map((item) => ({ sku: item.sku, label: item.label, durationMinutes: item.durationMinutes }))
}

export type TransportOption = {
    sku: string
    label: string
    aliases: string[]
}

export const DEFAULT_TRANSPORT_OPTIONS: TransportOption[] = [
    { sku: "airport", label: "Airport transfer", aliases: ["airport transfer", "airport pickup", "airport pick up", "airport", "birsa munda"] },
    { sku: "taxi", label: "Local taxi", aliases: ["taxi", "cab"] },
    { sku: "scooter", label: "Scooter", aliases: ["scooter", "two-wheeler", "bike rental"] },
]

export function defaultTransportOptions() {
    return DEFAULT_TRANSPORT_OPTIONS.map((item) => ({ sku: item.sku, label: item.label }))
}

export type HotelExperience = {
    sku: string
    label: string
    summary: string
    aliases: string[]
}

export const DEFAULT_HOTEL_EXPERIENCES: HotelExperience[] = [
    { sku: "hinoo-walk", label: "Hinoo evening walk", summary: "A slow walk from the hotel toward Hinoo Main Road after 17:00.", aliases: ["hinoo evening", "evening walk", "hinoo walk"] },
    { sku: "lake-morning", label: "Ranchi lake morning", summary: "Early walk around Ranchi Lake. Reception can arrange a taxi.", aliases: ["ranchi lake", "lake morning", "lake"] },
    { sku: "jagannath", label: "Jagannath temple visit", summary: "A short ride to Jagannath Temple. Tell reception a time.", aliases: ["jagannath", "temple visit", "temple"] },
]

export function defaultHotelExperiences() {
    return DEFAULT_HOTEL_EXPERIENCES.map((item) => ({ sku: item.sku, label: item.label, summary: item.summary }))
}

export const HOTEL_SERVICE_OPTIONS = [
    { id: "restaurant", label: "Restaurant" },
    { id: "roomService", label: "Room service" },
    { id: "housekeeping", label: "Housekeeping" },
    { id: "laundry", label: "Laundry" },
    { id: "spa", label: "Spa" },
    { id: "gym", label: "Gym" },
    { id: "pool", label: "Pool" },
    { id: "transport", label: "Transport" },
    { id: "airportTransfer", label: "Airport transfer" },
    { id: "activities", label: "Activities" },
    { id: "tours", label: "Tours" },
    { id: "concierge", label: "Concierge" },
    { id: "parking", label: "Parking" },
    { id: "businessCentre", label: "Business centre" },
    { id: "kids", label: "Kids activities" },
    { id: "events", label: "Event spaces" },
] as const

export const DEFAULT_HOTEL_SERVICES = ["restaurant", "housekeeping", "concierge"] as const
