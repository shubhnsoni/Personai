import { randomBytes } from "node:crypto"

export function generateHotelQrCode() {
    return `h${randomBytes(9).toString("base64url")}`
}

export function generateStayToken() {
    return randomBytes(18).toString("base64url")
}
