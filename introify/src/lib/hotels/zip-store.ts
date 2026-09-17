const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[i] = c >>> 0
    }
    return table
})()

export function crc32(data: Uint8Array): number {
    let c = 0xffffffff
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

export type ZipEntry = { name: string; data: Uint8Array }

function u16(view: DataView, offset: number, value: number) {
    view.setUint16(offset, value, true)
}

function u32(view: DataView, offset: number, value: number) {
    view.setUint32(offset, value, true)
}

export function zipStore(entries: ZipEntry[]): Uint8Array {
    const locals: Uint8Array[] = []
    const centrals: Uint8Array[] = []
    let offset = 0
    for (const entry of entries) {
        const name = new TextEncoder().encode(entry.name.replace(/\\/g, "/"))
        const crc = crc32(entry.data)
        const local = new Uint8Array(30 + name.length + entry.data.length)
        const lv = new DataView(local.buffer)
        u32(lv, 0, 0x04034b50)
        u16(lv, 4, 20)
        u16(lv, 6, 0)
        u16(lv, 8, 0)
        u16(lv, 10, 0)
        u16(lv, 12, 0)
        u32(lv, 14, crc)
        u32(lv, 18, entry.data.length)
        u32(lv, 22, entry.data.length)
        u16(lv, 26, name.length)
        u16(lv, 28, 0)
        local.set(name, 30)
        local.set(entry.data, 30 + name.length)
        locals.push(local)

        const central = new Uint8Array(46 + name.length)
        const cv = new DataView(central.buffer)
        u32(cv, 0, 0x02014b50)
        u16(cv, 4, 20)
        u16(cv, 6, 20)
        u16(cv, 8, 0)
        u16(cv, 10, 0)
        u16(cv, 12, 0)
        u16(cv, 14, 0)
        u32(cv, 16, crc)
        u32(cv, 20, entry.data.length)
        u32(cv, 24, entry.data.length)
        u16(cv, 28, name.length)
        u16(cv, 30, 0)
        u16(cv, 32, 0)
        u16(cv, 34, 0)
        u16(cv, 36, 0)
        u32(cv, 38, 0)
        u32(cv, 42, offset)
        central.set(name, 46)
        centrals.push(central)
        offset += local.length
    }

    const cdSize = centrals.reduce((sum, row) => sum + row.length, 0)
    const eocd = new Uint8Array(22)
    const ev = new DataView(eocd.buffer)
    u32(ev, 0, 0x06054b50)
    u16(ev, 4, 0)
    u16(ev, 6, 0)
    u16(ev, 8, entries.length)
    u16(ev, 10, entries.length)
    u32(ev, 12, cdSize)
    u32(ev, 16, offset)
    u16(ev, 20, 0)

    const total = offset + cdSize + eocd.length
    const out = new Uint8Array(total)
    let cursor = 0
    for (const part of [...locals, ...centrals, eocd]) {
        out.set(part, cursor)
        cursor += part.length
    }
    return out
}

export function unzipStore(buf: Uint8Array): Record<string, Uint8Array> {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const files: Record<string, Uint8Array> = {}
    let offset = 0
    while (offset + 4 <= buf.length) {
        const sig = view.getUint32(offset, true)
        if (sig === 0x02014b50 || sig === 0x06054b50) break
        if (sig !== 0x04034b50) throw new Error("Not a stored ZIP")
        const method = view.getUint16(offset + 8, true)
        if (method !== 0) throw new Error("ZIP entry is compressed")
        const size = view.getUint32(offset + 22, true)
        const nameLen = view.getUint16(offset + 26, true)
        const extraLen = view.getUint16(offset + 28, true)
        const nameStart = offset + 30
        const name = new TextDecoder().decode(buf.subarray(nameStart, nameStart + nameLen))
        const dataStart = nameStart + nameLen + extraLen
        files[name] = buf.slice(dataStart, dataStart + size)
        offset = dataStart + size
    }
    return files
}
