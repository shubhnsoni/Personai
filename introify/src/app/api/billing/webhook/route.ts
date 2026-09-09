import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { billingMode } from "@/lib/billing/config"
import { platformStripe, processBillingEvent } from "@/lib/billing/stripe-platform"

export const runtime = "nodejs"
export async function POST(request: Request) {
    const signature = request.headers.get("stripe-signature")
    const secret = process.env.INTROIFY_STRIPE_WEBHOOK_SECRET
    if (!signature || !secret) return NextResponse.json({ error: "Webhook unavailable" }, { status: 400 })
    let event
    try { event = platformStripe().webhooks.constructEvent(await request.text(), signature, secret) }
    catch { return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 }) }
    if (event.livemode !== (billingMode() === "live") || (process.env.NODE_ENV === "production" && !event.livemode)) return NextResponse.json({ error: "Wrong billing environment" }, { status: 400 })
    const id = `stripe:${event.livemode ? "live" : "test"}:${event.id}`
    try {
        await prisma.billingProviderEvent.upsert({ where: { id }, create: { id, liveMode: event.livemode, type: event.type, payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue }, update: {} })
        await processBillingEvent(id)
        return NextResponse.json({ received: true })
    } catch { return NextResponse.json({ error: "Webhook saved for retry or storage temporarily unavailable" }, { status: 503 }) }
}
