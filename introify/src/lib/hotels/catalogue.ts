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
