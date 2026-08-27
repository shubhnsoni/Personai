import { hasSurface, type Surface } from "@/lib/surfaces"
import { businessOsError, businessOsJson } from "@/lib/business-os/api/responses"

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"

export type FakeProfile = {
  id: string
  roleTemplate: string | null
  personalityConfig?: string | null
}

export type FakeSession = {
  userId: string
  profiles: FakeProfile[]
}

export type FakeAuthSessionProvider = {
  getSession(): Promise<FakeSession | null>
}

export type FakeSurfaceEntitlementProvider = {
  allows(profile: FakeProfile, surface: Surface): boolean
}

export type RouteHandler = (request: Request) => Promise<Response>

export type InvokedResponse = {
  status: number
  body: {
    ok: boolean
    error?: { code: ErrorCode; message: string; details?: Record<string, unknown> }
    data?: unknown
  }
}

export function createFakeAuthSession(session: FakeSession | null): FakeAuthSessionProvider {
  const seeded = session === null
    ? null
    : {
        userId: session.userId,
        profiles: session.profiles.map((profile) => ({ ...profile })),
      }

  return {
    async getSession() {
      return seeded === null
        ? null
        : {
            userId: seeded.userId,
            profiles: seeded.profiles.map((profile) => ({ ...profile })),
          }
    },
  }
}

export function createFakeSurfaceEntitlements(): FakeSurfaceEntitlementProvider {
  return {
    allows(profile, surface) {
      return hasSurface(profile.roleTemplate, surface, profile.personalityConfig ? JSON.parse(profile.personalityConfig).extras : undefined)
    },
  }
}

/**
 * A route-handler-shaped Business OS boundary. It deliberately separates authentication
 * (401) from an authenticated caller without the required surface (403).
 */
export function createBusinessOsRoute(
  auth: FakeAuthSessionProvider,
  entitlements: FakeSurfaceEntitlementProvider,
  onAllowed: (request: Request, session: FakeSession) => Promise<Response> | Response = () => businessOsJson({ allowed: true }),
): RouteHandler {
  return async (request) => {
    const session = await auth.getSession()
    if (!session) return businessOsError("UNAUTHORIZED", "Sign in to read Business OS blueprints")

    const profile = session.profiles[0]
    if (!profile || !entitlements.allows(profile, "businessOs")) {
      return businessOsError("FORBIDDEN", "This profile does not have the Business OS surface")
    }

    return onAllowed(request, session)
  }
}

export async function invokeRoute(handler: RouteHandler, path = "/api/business-os/blueprints"): Promise<InvokedResponse> {
  const response = await handler(new Request(`https://test.invalid${path}`))
  return { status: response.status, body: await response.json() as InvokedResponse["body"] }
}

export type FakeTenantContext = { tenantId: string | null }

export function createFakeTenantContext(tenantId: string | null): () => FakeTenantContext {
  return () => ({ tenantId })
}

export type TenantRecord<T> = {
  id: string
  tenantId: string
  value: T
}

export type TenantBoundaryResult<T> =
  | { ok: true; value: TenantRecord<T> }
  | { ok: false; code: ErrorCode; message: string }

/**
 * In-memory server boundary: callers cannot supply a filter to bypass tenant scoping.
 * Every read and write obtains its tenant from the supplied context provider.
 */
export class InMemoryTenantBoundary<T> {
  private readonly records = new Map<string, TenantRecord<T>>()

  constructor(seed: readonly TenantRecord<T>[]) {
    for (const record of seed) this.records.set(record.id, { ...record })
  }

  read(context: FakeTenantContext, id: string): TenantBoundaryResult<T> {
    if (!context.tenantId) return { ok: false, code: "UNAUTHORIZED", message: "Sign in to access tenant data" }
    const record = this.records.get(id)
    if (!record) return { ok: false, code: "NOT_FOUND", message: "Tenant record was not found" }
    if (record.tenantId !== context.tenantId) return { ok: false, code: "FORBIDDEN", message: "Cross-tenant access is forbidden" }
    return { ok: true, value: { ...record } }
  }

  write(context: FakeTenantContext, input: { id: string; value: T; tenantId?: string }): TenantBoundaryResult<T> {
    if (!context.tenantId) return { ok: false, code: "UNAUTHORIZED", message: "Sign in to access tenant data" }
    if (input.tenantId && input.tenantId !== context.tenantId) {
      return { ok: false, code: "FORBIDDEN", message: "Cross-tenant access is forbidden" }
    }

    const existing = this.records.get(input.id)
    if (existing && existing.tenantId !== context.tenantId) {
      return { ok: false, code: "FORBIDDEN", message: "Cross-tenant access is forbidden" }
    }

    const record = { id: input.id, tenantId: context.tenantId, value: input.value }
    this.records.set(record.id, record)
    return { ok: true, value: { ...record } }
  }
}

export function tenantResultResponse<T>(result: TenantBoundaryResult<T>): Response {
  if (result.ok) return businessOsJson(result.value)
  return businessOsError(result.code, result.message)
}
