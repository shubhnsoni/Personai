"use server"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { paymentQrUrlFromConfig, upiPayHref, writePaymentQrUrl } from "@/lib/payment-qr"
import { qrSvg } from "@/lib/qr-svg"
import { uploadsDirectory } from "@/lib/uploads-storage"

export async function ensureProfilePaymentQr(profileId: string) {
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, slug: true, upiId: true, displayName: true, personalityConfig: true },
    })
    if (!profile?.upiId) return paymentQrUrlFromConfig(profile?.personalityConfig)
    const existing = paymentQrUrlFromConfig(profile.personalityConfig)
    if (existing) return existing
    const href = upiPayHref({ upiId: profile.upiId, name: profile.displayName })
    const svg = qrSvg(href, 640)
    const filename = `${profile.slug}-upi.svg`
    if (filename.length > 255 || !/^[a-z0-9][a-z0-9-]*-upi\.svg$/.test(filename)) {
        throw new Error("Unsafe payment QR filename")
    }
    const directory = uploadsDirectory()
    const abs = path.resolve(directory, filename)
    if (path.dirname(abs) !== directory) throw new Error("Unsafe payment QR path")
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, svg, "utf8")
    const url = `/uploads/${filename}`
    await prisma.profile.update({
        where: { id: profile.id },
        data: { personalityConfig: writePaymentQrUrl(profile.personalityConfig, url) },
    })
    return url
}
