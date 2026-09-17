import { resolveKitRole } from "@/lib/role-alias"

export function isHotelRole(role?: string | null): boolean {
    return resolveKitRole(role) === "HOTEL"
}
