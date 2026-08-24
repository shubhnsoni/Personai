export const AUTH_LOOKS = [
    { id: "glass", name: "Glass", blurb: "Centered card" },
    { id: "type", name: "Type", blurb: "Big title, no box" },
    { id: "dock", name: "Dock", blurb: "Sheet from the bottom" },
    { id: "frame", name: "Frame", blurb: "Hairline outline" },
    { id: "well", name: "Well", blurb: "Compact inset" },
] as const

export type AuthLookId = (typeof AUTH_LOOKS)[number]["id"]

export function isAuthLook(value: string | null | undefined): value is AuthLookId {
    return AUTH_LOOKS.some((look) => look.id === value)
}
