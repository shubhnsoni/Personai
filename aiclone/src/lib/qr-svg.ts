import { encodeQr } from "@/lib/qr-encode"

export function qrSvg(url: string, size = 512) {
    const matrix = encodeQr(url)
    const n = matrix.size
    const cells: string[] = []
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (matrix.get(y, x)) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" fill="#111">${cells.join("")}</svg>`
}
