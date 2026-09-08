"use server"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { paymentQrUrlFromConfig, upiPayHref, writePaymentQrUrl } from "@/lib/payment-qr"
import { qrSvg } from "@/lib/qr-svg"

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
    const rel = path.posix.join("uploads", `${profile.slug}-upi.svg`)
    const abs = path.join(process.cwd(), "public", rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, svg, "utf8")
    const url = `/${rel}`
    await prisma.profile.update({
        where: { id: profile.id },
        data: { personalityConfig: writePaymentQrUrl(profile.personalityConfig, url) },
    })
    return url
}
