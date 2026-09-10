export const LCD_PALETTE = { paper: "#c4d58a", ink: "#253021" } as const

export const LCD_SIZE = 80

/** Horizontal runs keep the pixel silhouette compact at every rendered size. */
function pixelPath(contains: (x: number, y: number) => boolean): string {
    const runs: string[] = []
    for (let y = 0; y < LCD_SIZE; y++) {
        let start = -1
        for (let x = 0; x <= LCD_SIZE; x++) {
            const filled = x < LCD_SIZE && contains(x + 0.5, y + 0.5)
            if (filled && start < 0) start = x
            if (!filled && start >= 0) {
                runs.push(`M${start} ${y}h${x - start}v1H${start}z`)
                start = -1
            }
        }
    }
    return runs.join("")
}

export const LCD_CIRCLE_PATH = pixelPath((x, y) => (x - 40) ** 2 + (y - 40) ** 2 <= 28 ** 2)

export type LcdLid = "none" | "blink" | "wink-left" | "wink-right"

export function lcdEyes({
    gaze = { x: 0, y: 0 },
    lid = "none",
    expression = "centre",
}: {
    gaze?: { x: number; y: number }
    lid?: LcdLid
    expression?: string
} = {}): [string, string] {
    const gx = Math.round(Math.max(-1, Math.min(1, gaze.x)) * 3)
    const gy = Math.round(Math.max(-1, Math.min(1, gaze.y)) * -2)
    return [33, 47].map((center, index) => {
        const closed = lid === "blink" || lid === (index === 0 ? "wink-left" : "wink-right")
        const happy = ["heureux", "hilare", "excite"].includes(expression)
        const sleepy = ["somnolent", "blase"].includes(expression)
        const wide = ["surpris", "effraye"].includes(expression)
        const width = wide || happy ? 6 : 4
        const shy = expression === "timide"
        const attentive = expression === "attentif"
        const height = closed ? 2 : sleepy ? 4 : wide || attentive ? 16 : shy ? 9 : expression === "curieux" && index === 1 ? 10 : 14
        const cx = center + gx + (shy ? (index === 0 ? 1 : -1) : 0)
        const cy = 38 + gy + (shy ? 3 : attentive ? -2 : 0)
        return pixelPath((x, y) => {
            const dx = Math.abs(x - cx)
            const dy = Math.abs(y - cy)
            if (happy && !closed) {
                const ridge = cy - 2 + Math.floor(dx / 2)
                return dx < width / 2 && y >= ridge && y < ridge + 2
            }
            if (closed || sleepy) return dx < width / 2 && dy < height / 2
            const radius = width / 2
            return dx ** 2 + Math.max(0, dy - (height / 2 - radius)) ** 2 <= radius ** 2
        })
    }) as [string, string]
}
