import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const publicLiveness = Object.freeze({ status: "ok" })
const detailsHeader = "x-health-diagnostics-token"

function isOperatorAuthorized(request: NextRequest): boolean {
  const expected = process.env.HEALTH_DIAGNOSTICS_TOKEN
  const supplied = request.headers.get(detailsHeader)
  if (!expected || !supplied) return false

  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

async function databaseDiagnostic(): Promise<"ok" | "unavailable"> {
  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.$queryRaw`SELECT 1`
    return "ok"
  } catch {
    // Diagnostics are deliberately categorical: provider errors and configuration state
    // are operationally useful to an attacker and must never become response content.
    return "unavailable"
  }
}

export async function GET(request: NextRequest) {
  const requestedDetails = request.nextUrl.searchParams.get("details") === "1"
  if (!requestedDetails || !isOperatorAuthorized(request)) {
    return NextResponse.json(publicLiveness)
  }

  const database = await databaseDiagnostic()
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database },
    { status: database === "ok" ? 200 : 503 },
  )
}
