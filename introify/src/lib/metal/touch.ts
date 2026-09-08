/** Wholesale bills in touch (percent of fine gold), against the 24K board. */

export function fineMg(grossMg: number, touchBps: number): number {
    if (grossMg <= 0 || touchBps <= 0) return 0
    return Math.round((grossMg * touchBps) / 10_000)
}

/** Paise for this weight billed at `touchBps` of 24K (`k24PaisePer10g`). */
export function touchPaise(grossMg: number, touchBps: number, k24PaisePer10g: number): number {
    if (k24PaisePer10g <= 0) return 0
    return Math.round((fineMg(grossMg, touchBps) * k24PaisePer10g) / 10_000)
}

export function touchBpsFromPercent(percent: number): number {
    if (!Number.isFinite(percent) || percent <= 0) return 0
    return Math.round(percent * 100)
}

export function touchPercent(touchBps: number): number {
    return touchBps / 100
}
