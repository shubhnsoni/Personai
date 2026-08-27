import { NextResponse } from "next/server"

import { syncUser } from "@/lib/auth-sync"
import {
  CopilotExecutionService,
  CopilotRuntimeError,
  PrismaCopilotExecutionRepository,
} from "@/lib/copilot/execution"
import { prisma } from "@/lib/prisma"
import { extrasOf, hasSurface } from "@/lib/surfaces"

export const executionService = new CopilotExecutionService(
  new PrismaCopilotExecutionRepository(prisma),
)

export async function requireCopilotRunAccess() {
  const user = await syncUser()
  if (!user) {
    return {
      ok: false as const,
      response: errorResponse("UNAUTHORIZED", "Sign in to use copilot runs.", 401),
    }
  }
  const profile = user.profiles[0]
  if (!profile) {
    return {
      ok: false as const,
      response: errorResponse("FORBIDDEN", "This account has no active profile.", 403),
    }
  }
  if (!hasSurface(profile.roleTemplate, "businessOs", extrasOf(profile))) {
    return {
      ok: false as const,
      response: errorResponse("FORBIDDEN", "This profile does not have the Business OS surface.", 403),
    }
  }
  return {
    ok: true as const,
    scope: { profileId: profile.id, actorId: user.id },
  }
}

export function okResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

export function runtimeErrorResponse(error: unknown) {
  if (error instanceof CopilotRuntimeError) {
    const status = error.code === "BAD_REQUEST"
      ? 400
      : error.code === "NOT_FOUND"
        ? 404
        : 409
    return errorResponse(error.code, error.message, status)
  }
  return errorResponse("INTERNAL_ERROR", "The copilot runtime request could not be completed.", 500)
}

export async function readObjectBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new CopilotRuntimeError("BAD_REQUEST", "Request body must be valid JSON.")
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CopilotRuntimeError("BAD_REQUEST", "Request body must be a JSON object.")
  }
  return body as Record<string, unknown>
}
