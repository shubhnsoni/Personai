export type ContentDisplayMode = "SIDE_PANEL" | "POPUP"

export function parseContentDisplayMode(raw?: string | null): ContentDisplayMode {
    return raw === "SIDE_PANEL" ? "SIDE_PANEL" : "POPUP"
}
