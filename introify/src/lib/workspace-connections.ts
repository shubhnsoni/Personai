export const CONNECTION_KINDS = ["FILES", "DRIVE", "CALENDAR", "GITHUB", "SHOP", "POS", "MESSAGING"] as const
export type ConnectionKind = (typeof CONNECTION_KINDS)[number]

export function connectionCatalog() {
    return [
        { kind: "FILES" as const, title: "Files already on Introify", blurb: "Notes, uploads, and knowledge the creator already stored." },
        { kind: "DRIVE" as const, title: "Google Drive", blurb: "Read selected folders. Write results only where approved." },
        { kind: "CALENDAR" as const, title: "Google Calendar", blurb: "Read availability. Creating events needs approval." },
        { kind: "GITHUB" as const, title: "GitHub", blurb: "Read a pull request or repo. Never push unless approved." },
        { kind: "SHOP" as const, title: "Shop and inventory", blurb: "Read listings and stock from the Introify shop." },
        { kind: "POS" as const, title: "Sales / POS", blurb: "Read sales for night reports. Cannot spend." },
        { kind: "MESSAGING" as const, title: "Business messaging", blurb: "Draft customer messages. Sending needs approval." },
    ]
}

export function actionNeedsApproval(action: string) {
    return ["send_message", "spend_money", "place_order", "publish", "delete_data", "modify_source"].includes(action)
}

export function permissionAllowed(grant: { scopes: string[] }, action: string) {
    return grant.scopes.includes(action)
}

export function defaultManifest(purpose: string) {
    return {
        purpose,
        required: ["FILES"],
        optional: [] as string[],
        actions: ["read", "create_draft"],
        approvalRequired: ["send_message", "publish"],
        disallowed: ["spend_money", "place_order", "modify_source"],
        background: false,
    }
}

export function connectionHealth(status: string) {
    if (status === "connected") return "Connected"
    if (status === "expired") return "Expired"
    if (status === "error") return "Needs attention"
    return "Unavailable"
}
