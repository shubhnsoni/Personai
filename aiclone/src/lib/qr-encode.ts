/** Byte-mode QR (versions 1–10, ECC M). Enough for a profile URL. */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
    let x = 1
    for (let i = 0; i < 255; i++) {
        EXP[i] = x
        LOG[x] = i
        x <<= 1
        if (x & 0x100) x ^= 0x11d
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function mul(a: number, b: number) {
    if (!a || !b) return 0
    return EXP[LOG[a] + LOG[b]]
}

function rsGenerator(ec: number) {
    let poly = [1]
    for (let i = 0; i < ec; i++) {
        const next = new Array(poly.length + 1).fill(0)
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j]
            next[j + 1] ^= mul(poly[j], EXP[i])
        }
        poly = next
    }
    return poly
}

function rsEncode(data: number[], ec: number) {
    const gen = rsGenerator(ec)
    const res = new Array(ec).fill(0)
    for (const b of data) {
        const factor = b ^ res[0]
        res.shift()
        res.push(0)
        if (!factor) continue
        for (let i = 0; i < gen.length - 1; i++) res[i] ^= mul(gen[i + 1], factor)
    }
    return res
}

/** version, total codewords, data codewords, EC per block, block count */
const VERSIONS: [number, number, number, number, number][] = [
    [1, 26, 16, 10, 1],
    [2, 44, 28, 16, 1],
    [3, 70, 44, 26, 1],
    [4, 100, 64, 18, 2],
    [5, 134, 86, 24, 2],
    [6, 172, 108, 16, 4],
    [7, 196, 124, 18, 4],
    [8, 242, 154, 22, 4],
    [9, 292, 182, 22, 5],
    [10, 346, 216, 26, 5],
]

function bitsToBytes(bits: number[]) {
    const out: number[] = []
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0
        for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0)
        out.push(v)
    }
    return out
}

function pushBits(bits: number[], value: number, len: number) {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1)
}

export function encodeQr(text: string): { size: number; get: (r: number, c: number) => boolean } {
    const bytes = Array.from(new TextEncoder().encode(text))
    const countBits = bytes.length < 32 ? 8 : 16
    const needed = 4 + countBits + bytes.length * 8 + 4
    const ver = VERSIONS.find((v) => v[2] * 8 >= needed)
    if (!ver) throw new Error("URL too long for QR")
    const [version, totalCw, dataCw, ecPer, blocks] = ver
    const bits: number[] = []
    pushBits(bits, 0b0100, 4)
    pushBits(bits, bytes.length, version <= 9 ? 8 : 16)
    for (const b of bytes) pushBits(bits, b, 8)
    const capacity = dataCw * 8
    const remain = capacity - bits.length
    pushBits(bits, 0, Math.min(4, remain))
    while (bits.length % 8) bits.push(0)
    const data = bitsToBytes(bits)
    const pads = [0xec, 0x11]
    let p = 0
    while (data.length < dataCw) data.push(pads[p++ % 2])

    const shortBlocks = blocks - (dataCw % blocks)
    const shortLen = Math.floor(dataCw / blocks)
    const dataBlocks: number[][] = []
    const eccBlocks: number[][] = []
    let offset = 0
    for (let i = 0; i < blocks; i++) {
        const len = shortLen + (i < shortBlocks ? 0 : 1)
        const block = data.slice(offset, offset + len)
        offset += len
        dataBlocks.push(block)
        eccBlocks.push(rsEncode(block, ecPer))
    }

    const interleaved: number[] = []
    const maxData = Math.max(...dataBlocks.map((g) => g.length))
    for (let i = 0; i < maxData; i++) {
        for (const g of dataBlocks) if (i < g.length) interleaved.push(g[i])
    }
    for (let i = 0; i < ecPer; i++) {
        for (const g of eccBlocks) interleaved.push(g[i])
    }
    while (interleaved.length < totalCw) interleaved.push(0)

    const size = version * 4 + 17
    const grid = Array.from({ length: size }, () => new Array<number>(size).fill(-1))

    function placeFinder(r: number, c: number) {
        for (let y = -1; y <= 7; y++) {
            for (let x = -1; x <= 7; x++) {
                const rr = r + y
                const cc = c + x
                if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue
                const on = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
                grid[rr][cc] = on ? 1 : 0
            }
        }
    }
    placeFinder(0, 0)
    placeFinder(0, size - 7)
    placeFinder(size - 7, 0)
    for (let i = 8; i < size - 8; i++) {
        if (grid[6][i] < 0) grid[6][i] = i % 2 === 0 ? 1 : 0
        if (grid[i][6] < 0) grid[i][6] = i % 2 === 0 ? 1 : 0
    }
    grid[size - 8][8] = 1

    const align: Record<number, number[]> = {
        2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
        7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    }
    const centers = align[version] || []
    for (const r of centers) {
        for (const c of centers) {
            if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue
            for (let y = -2; y <= 2; y++) {
                for (let x = -2; x <= 2; x++) {
                    const on = Math.max(Math.abs(x), Math.abs(y)) === 2 || (x === 0 && y === 0)
                    grid[r + y][c + x] = on ? 1 : 0
                }
            }
        }
    }

    const stream: number[] = []
    for (const b of interleaved) {
        for (let i = 7; i >= 0; i--) stream.push((b >> i) & 1)
    }
    let bi = 0
    let up = true
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--
        for (let i = 0; i < size; i++) {
            const row = up ? size - 1 - i : i
            for (const c of [col, col - 1]) {
                if (grid[row][c] >= 0) continue
                const bit = stream[bi++] || 0
                const mask = (row + c) % 2 === 0
                grid[row][c] = mask ? bit ^ 1 : bit
            }
        }
        up = !up
    }

    // format info for mask 0, ECC M = 0b00_000, format bits 0b101010000010010
    const format = 0b101010000010010
    const positions = [
        [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]],
        [[8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4], [8, size - 5], [8, size - 6], [8, size - 7], [size - 8, 8], [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8], [size - 3, 8], [size - 2, 8], [size - 1, 8]],
    ]
    for (const set of positions) {
        set.forEach(([r, c], i) => {
            grid[r][c] = (format >> (14 - i)) & 1
        })
    }

    return {
        size,
        get: (r, c) => grid[r][c] === 1,
    }
}
