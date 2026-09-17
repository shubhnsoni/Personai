import { isHotelRole } from "./role"

export type HotelGroupConfig = {
    name: string
    hotelProfileIds: string[]
}

export type HotelGroupHotel = {
    id: string
    slug: string
    displayName: string
    roleTemplate: string
}

export function parseHotelGroupJson(raw?: string | null): HotelGroupConfig {
    try {
        const value = JSON.parse(raw || "{}")
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return { name: "", hotelProfileIds: [] }
        }
        const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : ""
        const ids: string[] = []
        if (Array.isArray(value.hotelProfileIds)) {
            for (const id of value.hotelProfileIds) {
                if (typeof id === "string" && id.trim()) ids.push(id.trim())
            }
        }
        return { name, hotelProfileIds: [...new Set(ids)] }
    } catch {
        return { name: "", hotelProfileIds: [] }
    }
}

export function listHotelGroupMembers(group: HotelGroupConfig, hotels: readonly HotelGroupHotel[]): HotelGroupHotel[] {
    const hotelOnly = hotels.filter((row) => isHotelRole(row.roleTemplate))
    if (!group.hotelProfileIds.length) return hotelOnly
    const allow = new Set(group.hotelProfileIds)
    return hotelOnly.filter((row) => allow.has(row.id))
}
