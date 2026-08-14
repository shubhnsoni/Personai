import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function checkDatabase(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, message: 'DATABASE_URL not configured' }
  }
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, message: 'Connected' }
  } catch (e) {
    return { ok: false, message: `Connection failed: ${(e as Error).message}` }
  }
}

function checkOpenAI(): { ok: boolean; message: string } {
  if (!process.env.OPENAI_API_KEY) return { ok: false, message: 'OPENAI_API_KEY not configured' }
  return { ok: true, message: 'Configured' }
}

function checkStripe(): { ok: boolean; message: string } {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, message: 'STRIPE_SECRET_KEY not configured' }
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) return { ok: false, message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not configured' }
  return { ok: true, message: 'Configured' }
}

function checkEmail(): { ok: boolean; message: string } {
  if (!process.env.RESEND_API_KEY) return { ok: false, message: 'RESEND_API_KEY not configured — falling back to console.log' }
  return { ok: true, message: 'Configured' }
}

function checkAuth(): { ok: boolean; message: string } {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return { ok: false, message: 'Clerk keys not configured' }
  }
  return { ok: true, message: 'Configured' }
}

export async function GET() {
  const db = await checkDatabase()
  const openai = checkOpenAI()
  const stripe = checkStripe()
  const email = checkEmail()
  const auth = checkAuth()

  const services = { database: db, openai, stripe, email, auth }
  const allOk = Object.values(services).every(s => s.ok)

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
  }, { status: allOk ? 200 : 503 })
}
