import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPurchaseConfirmation } from '@/lib/email'

/**
 * Generate a secure download token for a product purchase and send email.
 * Call this after a successful payment webhook for digital products.
 */
export async function generateDownloadLink(purchaseId: string, profileDisplayName: string): Promise<string | null> {
    const token = randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const purchase = await prisma.productPurchase.update({
        where: { id: purchaseId },
        data: {
            downloadToken: token,
            downloadExpiry: expiry,
            status: 'COMPLETED',
        },
        include: { product: true },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const downloadUrl = `${baseUrl}/api/downloads/${token}`

    // Send email with download link
    await sendPurchaseConfirmation({
        visitorEmail: purchase.visitorEmail,
        visitorName: purchase.visitorName || undefined,
        itemType: 'product',
        itemName: purchase.product.title,
        priceCents: purchase.product.priceCents,
        profileDisplayName,
        downloadUrl,
    })

    return downloadUrl
}
