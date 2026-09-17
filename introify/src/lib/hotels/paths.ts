import { normalizeRoomNumber } from "./rooms"

export function hotelPropertyPath(slug: string): string {
    return `/${slug}`
}

export function hotelRoomPath(slug: string, roomNumber: string): string {
    return `/${slug}/r/${encodeURIComponent(normalizeRoomNumber(roomNumber) || roomNumber)}`
}

export function hotelStayPath(slug: string, token: string): string {
    return `/${slug}/stay/${encodeURIComponent(token)}`
}

export function hotelQrPath(code: string): string {
    return `/q/${encodeURIComponent(code)}`
}

export function hotelQrTargetPath(input: {
    kind: string
    slug: string
    roomNumber?: string | null
    stayToken?: string | null
}): string {
    const kind = input.kind.toUpperCase()
    if (kind === "ROOM" && input.roomNumber) return hotelRoomPath(input.slug, input.roomNumber)
    if (kind === "STAY" && input.stayToken) return hotelStayPath(input.slug, input.stayToken)
    return hotelPropertyPath(input.slug)
}

/** Property, room, and stay chat share one viewport; catalogues keep normal page scroll. */
export function isPublicChatViewportPath(pathname: string, profilePath: string): boolean {
    const path = pathname.replace(/\/$/, "") || "/"
    const root = profilePath.replace(/\/$/, "") || "/"
    if (path === root) return true
    if (!path.startsWith(`${root}/`)) return false
    const [kind, id, extra] = path.slice(root.length + 1).split("/")
    return Boolean(id) && !extra && (kind === "r" || kind === "stay")
}
