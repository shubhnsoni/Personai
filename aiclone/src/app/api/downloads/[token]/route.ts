import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params

        const purchase = await prisma.productPurchase.findUnique({
            where: { downloadToken: token },
            include: { product: true },
        })

        if (!purchase) {
            return NextResponse.json({ error: 'Invalid download link' }, { status: 404 })
        }

        if (purchase.status !== 'COMPLETED') {
            return NextResponse.json({ error: 'Purchase not completed' }, { status: 403 })
        }

        if (purchase.downloadExpiry && new Date() > purchase.downloadExpiry) {
            return NextResponse.json({ error: 'Download link has expired' }, { status: 410 })
        }

        if (!purchase.product.fileUrl) {
            return NextResponse.json({ error: 'No file available for this product' }, { status: 404 })
        }

        // Update downloaded timestamp
        await prisma.productPurchase.update({
            where: { id: purchase.id },
            data: { downloadedAt: new Date() },
        })

        // Increment download count
        await prisma.digitalProduct.update({
            where: { id: purchase.productId },
            data: { downloadCount: { increment: 1 } },
        })

        // Redirect to the file URL (could be S3, R2, etc.)
        return NextResponse.redirect(purchase.product.fileUrl)
    } catch (error) {
        console.error('Download error:', error)
        return NextResponse.json({ error: 'Download failed' }, { status: 500 })
    }
}
