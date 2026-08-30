import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

import { PrismaClient, type Prisma } from "@prisma/client"
import ts from "typescript"

import { assertDisposableTarget } from "../lib/disposable-db"
import {
  CopilotExecutionService,
  CopilotRuntimeError,
  PrismaCopilotExecutionRepository,
  resolveCopilotAction,
  type ExecutionWorkflowRun,
} from "../../src/lib/copilot/execution"
import { isApprovalReason } from "../../src/lib/copilot/runtime"
import { PersistedActivities } from "../../src/lib/persistence/activities"
import { PersistedContacts } from "../../src/lib/persistence/contacts"
import { PlatformService } from "../../src/lib/persistence/service"
import { PersistedTaskQueue } from "../../src/lib/persistence/tasks"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import {
  createOwnershipFoundation,
  unwrapOwnershipResult,
  type SecurityUser,
  type ServerIdentitySource,
} from "../../src/lib/security/ownership"
import { extrasOf, hasSurface, writeExtras } from "../../src/lib/surfaces"

// This harness executes canonical onboarding, platform routes, Prisma Copilot
// approval/audit execution, cross-tenant refusals, and transaction rollback.
const EXPECTED_DATABASE = "personalink_phase0_rehearsal_20260826_210704"
const invert = process.env.INVERT_ASSERTION === "1"
const prefix = `p2-e2e-${process.pid}-${Date.now()}`
const prisma = new PrismaClient()
const nativeRequire = createRequire(__filename)
const failures: string[] = []
const checks: string[] = []
let externalCalls = 0

function check(name: string, condition: unknown, central = false): void {
  checks.push(name)
  const passed = central && invert ? !condition : Boolean(condition)
  if (!passed) failures.push(name)
}

function errorShape(error: unknown): string {
  if (!(error instanceof Error)) return JSON.stringify({ name: typeof error, message: String(error) })
  const tagged = error as Error & { code?: unknown; status?: unknown }
  return JSON.stringify({ name: error.name, message: error.message, code: tagged.code, status: tagged.status })
}

async function captureError(invoke: () => Promise<unknown>): Promise<unknown | null> {
  try {
    await invoke()
    return null
  } catch (error) {
    return error
  }
}

type TransactionalClient = Prisma.TransactionClient & {
  $transaction: <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => Promise<T>
}

function transactionalClient(tx: Prisma.TransactionClient): TransactionalClient {
  const proxy = new Proxy(tx as TransactionalClient, {
    get(target, property, receiver) {
      if (property === "$transaction") {
        return async <T>(callback: (inner: Prisma.TransactionClient) => Promise<T>) => callback(proxy)
      }
      const value = Reflect.get(target, property, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
  return proxy
}

type LoadedModule = Record<string, unknown>

function loadTypeScriptModule(relativePath: string, overrides: Readonly<Record<string, unknown>>): LoadedModule {
  const filename = path.resolve(relativePath)
  const source = fs.readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = { exports: {} as LoadedModule }
  const localRequire = (request: string): unknown => Object.prototype.hasOwnProperty.call(overrides, request)
    ? overrides[request]
    : nativeRequire(request)
  const execute = new Function("exports", "require", "module", "__filename", "__dirname", output)
  execute(loaded.exports, localRequire, loaded, filename, path.dirname(filename))
  return loaded.exports
}

type TestProfile = Readonly<{ id: string }>

class MutableSecurityIdentity implements ServerIdentitySource<TestProfile> {
  current: SecurityUser<TestProfile> | null = null
  async resolve(): Promise<SecurityUser<TestProfile> | null> {
    return this.current
  }
}

class MutablePlatformIdentity implements PlatformIdentity {
  current: string | null = null
  async userId(): Promise<string | null> {
    return this.current
  }
}

type ApiEnvelope<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>

async function responseBody<T>(response: Response): Promise<ApiEnvelope<T>> {
  return await response.json() as ApiEnvelope<T>
}

function dataOf<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.ok) throw new Error(`Unexpected ${envelope.error.code}: ${envelope.error.message}`)
  return envelope.data
}

function request(pathname: string, method = "GET", body?: unknown): Request {
  return new Request(`http://platform.invalid${pathname}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

type OnboardingModule = Readonly<{
  createProfile(data: Readonly<Record<string, unknown>>): Promise<Readonly<{ slug: string; next: string }>>
}>

type CollectionRoute = Readonly<{
  GET(request: Request): Promise<Response>
  POST(request: Request): Promise<Response>
}>

type WorkspaceRoute = Readonly<{ GET(): Promise<Response> }>
type CopilotRunsRoute = Readonly<{ GET(): Promise<Response>; POST(request: Request): Promise<Response> }>
type CopilotDetailRoute = Readonly<{
  GET(request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response>
}>
type CopilotApprovalRoute = Readonly<{
  POST(request: Request, context: { params: Promise<{ runId: string; approvalId: string }> }): Promise<Response>
}>
type CopilotExecuteRoute = Readonly<{
  POST(request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response>
}>

type CopilotUser = Readonly<{
  id: string
  profiles: readonly Readonly<{
    id: string
    roleTemplate: string
    personalityConfig: string | null
  }>[]
}>

class RollbackProof extends Error {}

async function runSuite(tx: Prisma.TransactionClient): Promise<void> {
  const db = transactionalClient(tx)
  const securityIdentity = new MutableSecurityIdentity()
  const foundation = createOwnershipFoundation(securityIdentity)
  const effects = { revalidations: 0, cookies: 0 }
  const onboarding = loadTypeScriptModule("src/app/actions/onboarding.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/security": {
      requireAuthenticatedUser: foundation.requireAuthenticatedUser,
      unwrapOwnershipResult,
    },
    "next/cache": { revalidatePath: () => { effects.revalidations += 1 } },
    "next/headers": { cookies: async () => ({ set: () => { effects.cookies += 1 } }) },
  }) as OnboardingModule

  const ownerUserId = `${prefix}-owner-user`
  const foreignUserId = `${prefix}-foreign-user`
  const ownerClerkId = `${prefix}-owner-clerk`
  const foreignClerkId = `${prefix}-foreign-clerk`
  await tx.user.createMany({
    data: [
      { id: ownerUserId, clerkId: ownerClerkId, email: `${prefix}-owner@example.invalid` },
      { id: foreignUserId, clerkId: foreignClerkId, email: `${prefix}-foreign@example.invalid` },
    ],
  })

  const anonymousOnboardingState = JSON.stringify({
    profiles: await tx.profile.count({ where: { userId: { in: [ownerUserId, foreignUserId] } } }),
    workspaces: await tx.workspace.count({ where: { slug: { contains: prefix } } }),
    memberships: await tx.membership.count({ where: { userId: { in: [ownerUserId, foreignUserId] } } }),
    effects,
  })
  securityIdentity.current = null
  const anonymousOnboardingError = await captureError(() => onboarding.createProfile({
    displayName: `${prefix} anonymous`,
    roleTemplate: "CUSTOM",
    primaryGoal: "TEST",
  }))
  check("anonymous onboarding is refused with 401",
    errorShape(anonymousOnboardingError).includes('"code":"UNAUTHORIZED"')
      && errorShape(anonymousOnboardingError).includes('"status":401'))
  check("anonymous onboarding has no database or framework side effect", anonymousOnboardingState === JSON.stringify({
    profiles: await tx.profile.count({ where: { userId: { in: [ownerUserId, foreignUserId] } } }),
    workspaces: await tx.workspace.count({ where: { slug: { contains: prefix } } }),
    memberships: await tx.membership.count({ where: { userId: { in: [ownerUserId, foreignUserId] } } }),
    effects,
  }))

  securityIdentity.current = Object.freeze({ id: ownerUserId, profiles: Object.freeze([]) })
  const ownerCreated = await onboarding.createProfile({
    displayName: `${prefix} owner business`,
    roleTemplate: "CUSTOM",
    primaryGoal: "TEST",
    userId: foreignUserId,
  })
  securityIdentity.current = Object.freeze({ id: foreignUserId, profiles: Object.freeze([]) })
  const foreignCreated = await onboarding.createProfile({
    displayName: `${prefix} foreign business`,
    roleTemplate: "CUSTOM",
    primaryGoal: "TEST",
  })

  const ownerProfile = await tx.profile.findUnique({ where: { slug: ownerCreated.slug } })
  const foreignProfile = await tx.profile.findUnique({ where: { slug: foreignCreated.slug } })
  if (!ownerProfile || !foreignProfile) throw new Error("Onboarding did not persist both profiles")
  const ownerWorkspace = await tx.workspace.findUnique({ where: { slug: ownerCreated.slug } })
  const foreignWorkspace = await tx.workspace.findUnique({ where: { slug: foreignCreated.slug } })
  if (!ownerWorkspace || !foreignWorkspace) throw new Error("Onboarding did not persist both workspaces")
  const ownerMembership = await tx.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: ownerWorkspace.id, userId: ownerUserId } },
  })
  check("onboarding ignores a forged caller identity and uses the server actor", ownerProfile.userId === ownerUserId)
  check("onboarding atomically provisions profile, workspace, and OWNER membership",
    ownerWorkspace.profileId === ownerProfile.id && ownerMembership?.role === "OWNER")
  check("onboarding revalidates but does not set an activation cookie unless requested",
    effects.revalidations === 2 && effects.cookies === 0)

  const ownerProfileWithAccess = await tx.profile.update({
    where: { id: ownerProfile.id },
    data: { personalityConfig: writeExtras(ownerProfile.personalityConfig, { surfaces: ["businessOs"] }) },
  })
  const foreignProfileWithAccess = await tx.profile.update({
    where: { id: foreignProfile.id },
    data: { personalityConfig: writeExtras(foreignProfile.personalityConfig, { surfaces: ["businessOs"] }) },
  })

  const platformIdentity = new MutablePlatformIdentity()
  const platformDb = db as unknown as PrismaClient
  const platformService = new PlatformService({
    tenancy: new PersistedTenancy(platformDb, platformIdentity),
    contacts: new PersistedContacts(platformDb),
    activities: new PersistedActivities(platformDb),
    tasks: new PersistedTaskQueue(platformDb),
  })
  const routeOverrides = { "@/lib/persistence": { platformService } }
  const workspaceRoute = loadTypeScriptModule("src/app/api/platform/workspaces/route.ts", routeOverrides) as WorkspaceRoute
  const contactRoute = loadTypeScriptModule("src/app/api/platform/contacts/route.ts", routeOverrides) as CollectionRoute
  const activityRoute = loadTypeScriptModule("src/app/api/platform/activities/route.ts", routeOverrides) as CollectionRoute
  const taskRoute = loadTypeScriptModule("src/app/api/platform/tasks/route.ts", routeOverrides) as CollectionRoute

  async function seedWorkspace(
    clerkId: string,
    workspaceId: string,
    profileId: string,
    label: "owner" | "foreign",
  ): Promise<Readonly<{ contactId: string; taskId: string }>> {
    platformIdentity.current = clerkId
    const contactResponse = await contactRoute.POST(request("/api/platform/contacts", "POST", {
      workspaceId,
      source: {
        sourceId: `${prefix}-${label}-booking`,
        sourceKind: "BOOKING_GUEST",
        profileId,
        name: `${label} contact`,
        email: `${prefix}-${label}-contact@example.invalid`,
        phone: null,
        observedAt: "2026-08-28T00:00:00.000Z",
      },
    }))
    check(`${label} contact persists through the route`, contactResponse.status === 201)
    const contact = dataOf(await responseBody<{ contact: { id: string } }>(contactResponse)).contact
    const activityResponse = await activityRoute.POST(request("/api/platform/activities", "POST", {
      workspaceId,
      events: [{
        id: `${prefix}-${label}-activity`,
        contactId: contact.id,
        profileId,
        type: "BOOKING_CREATED",
        sourceKind: "BOOKING_GUEST",
        sourceId: `${prefix}-${label}-booking`,
        occurredAt: "2026-08-28T00:01:00.000Z",
        summary: `${label} booking created`,
        metadata: { source: "p2-e2e" },
      }],
    }))
    check(`${label} activity persists through the route`, activityResponse.status === 201)
    const taskResponse = await taskRoute.POST(request("/api/platform/tasks", "POST", {
      workspaceId,
      payload: { kind: "OWNER_FOLLOW_UP", title: `${prefix}-${label}-task` },
      idempotencyKey: `${prefix}-${label}-task`,
      maxAttempts: 3,
    }))
    check(`${label} task persists through the route`, taskResponse.status === 202)
    const task = dataOf(await responseBody<{ task: { id: string } }>(taskResponse)).task
    return Object.freeze({ contactId: contact.id, taskId: task.id })
  }

  const ownerData = await seedWorkspace(ownerClerkId, ownerWorkspace.id, ownerProfile.id, "owner")
  const foreignData = await seedWorkspace(foreignClerkId, foreignWorkspace.id, foreignProfile.id, "foreign")

  platformIdentity.current = ownerClerkId
  const workspaceResponse = await workspaceRoute.GET()
  const workspaceEnvelope = await responseBody<{ workspaces: readonly { id: string }[] }>(workspaceResponse)
  check("authenticated workspace route returns only the actor membership",
    workspaceResponse.status === 200
      && dataOf(workspaceEnvelope).workspaces.length === 1
      && dataOf(workspaceEnvelope).workspaces[0]?.id === ownerWorkspace.id,
    true)

  const contactResponse = await contactRoute.GET(request(`/api/platform/contacts?workspaceId=${ownerWorkspace.id}`))
  const contactEnvelope = await responseBody<{ contacts: readonly { id: string }[] }>(contactResponse)
  check("persisted contact read returns only the owner workspace",
    contactResponse.status === 200
      && dataOf(contactEnvelope).contacts.length === 1
      && dataOf(contactEnvelope).contacts[0]?.id === ownerData.contactId)

  const activityResponse = await activityRoute.GET(request(`/api/platform/activities?workspaceId=${ownerWorkspace.id}`))
  const activityEnvelope = await responseBody<{ events: readonly { sourceId: string }[] }>(activityResponse)
  check("persisted activity read returns only the owner workspace",
    activityResponse.status === 200
      && dataOf(activityEnvelope).events.length === 1
      && dataOf(activityEnvelope).events[0]?.sourceId === `${prefix}-owner-booking`)

  const taskResponse = await taskRoute.GET(request(`/api/platform/tasks?workspaceId=${ownerWorkspace.id}`))
  const taskEnvelope = await responseBody<{ tasks: readonly { id: string }[] }>(taskResponse)
  check("persisted task read returns only the owner workspace",
    taskResponse.status === 200
      && dataOf(taskEnvelope).tasks.length === 1
      && dataOf(taskEnvelope).tasks[0]?.id === ownerData.taskId
      && dataOf(taskEnvelope).tasks[0]?.id !== foreignData.taskId)

  const refusalState = JSON.stringify({
    contacts: await tx.contact.count(),
    activities: await tx.activityEvent.count(),
    tasks: await tx.taskJob.count(),
  })
  platformIdentity.current = null
  const anonymousTaskResponse = await taskRoute.GET(request(`/api/platform/tasks?workspaceId=${ownerWorkspace.id}`))
  check("anonymous platform read is 401 with no data",
    anonymousTaskResponse.status === 401 && !(await responseBody(anonymousTaskResponse)).ok)

  platformIdentity.current = foreignClerkId
  const foreignTaskResponse = await taskRoute.GET(request(`/api/platform/tasks?workspaceId=${ownerWorkspace.id}`))
  const foreignTaskEnvelope = await responseBody(foreignTaskResponse)
  const missingTaskResponse = await taskRoute.GET(request(`/api/platform/tasks?workspaceId=${prefix}-missing-workspace`))
  const missingTaskEnvelope = await responseBody(missingTaskResponse)
  check("foreign workspace task read is forbidden", foreignTaskResponse.status === 403 && !foreignTaskEnvelope.ok)
  check("foreign and missing workspace refusals do not leak existence",
    missingTaskResponse.status === 403 && JSON.stringify(foreignTaskEnvelope) === JSON.stringify(missingTaskEnvelope))
  check("refused platform reads have no side effect", refusalState === JSON.stringify({
    contacts: await tx.contact.count(),
    activities: await tx.activityEvent.count(),
    tasks: await tx.taskJob.count(),
  }))

  const copilotIdentity: { current: CopilotUser | null } = { current: null }
  const sharedModule = loadTypeScriptModule("src/app/api/copilot/runs/_shared.ts", {
    "next/server": {
      NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) },
    },
    "@/lib/auth-sync": { syncUser: async () => copilotIdentity.current },
    "@/lib/copilot/execution": {
      CopilotExecutionService,
      CopilotRuntimeError,
      PrismaCopilotExecutionRepository,
    },
    "@/lib/prisma": { prisma: db },
    "@/lib/surfaces": { extrasOf, hasSurface },
  })
  const executionExports = { CopilotRuntimeError, resolveCopilotAction }
  const runsRoute = loadTypeScriptModule("src/app/api/copilot/runs/route.ts", {
    "@/lib/copilot/runtime": { isApprovalReason },
    "@/lib/copilot/execution": executionExports,
    "./_shared": sharedModule,
  }) as CopilotRunsRoute
  const detailRoute = loadTypeScriptModule("src/app/api/copilot/runs/[runId]/route.ts", {
    "../_shared": sharedModule,
  }) as CopilotDetailRoute
  const approvalRoute = loadTypeScriptModule("src/app/api/copilot/runs/[runId]/approvals/[approvalId]/route.ts", {
    "@/lib/copilot/execution": executionExports,
    "../../../_shared": sharedModule,
  }) as CopilotApprovalRoute
  const executeRoute = loadTypeScriptModule("src/app/api/copilot/runs/[runId]/execute/route.ts", {
    "@/lib/copilot/execution": executionExports,
    "../../_shared": sharedModule,
  }) as CopilotExecuteRoute

  const ownerCopilotUser: CopilotUser = Object.freeze({
    id: ownerUserId,
    profiles: Object.freeze([{
      id: ownerProfileWithAccess.id,
      roleTemplate: ownerProfileWithAccess.roleTemplate,
      personalityConfig: ownerProfileWithAccess.personalityConfig,
    }]),
  })
  const foreignCopilotUser: CopilotUser = Object.freeze({
    id: foreignUserId,
    profiles: Object.freeze([{
      id: foreignProfileWithAccess.id,
      roleTemplate: foreignProfileWithAccess.roleTemplate,
      personalityConfig: foreignProfileWithAccess.personalityConfig,
    }]),
  })

  copilotIdentity.current = null
  const anonymousRunsResponse = await runsRoute.GET()
  check("anonymous Copilot run read is 401 with no data", anonymousRunsResponse.status === 401
    && !(await responseBody(anonymousRunsResponse)).ok)
  copilotIdentity.current = Object.freeze({
    id: ownerUserId,
    profiles: Object.freeze([{
      id: ownerProfile.id,
      roleTemplate: ownerProfile.roleTemplate,
      personalityConfig: null,
    }]),
  })
  const unentitledRunsResponse = await runsRoute.GET()
  check("profile without Business OS entitlement is 403", unentitledRunsResponse.status === 403
    && !(await responseBody(unentitledRunsResponse)).ok)

  copilotIdentity.current = ownerCopilotUser
  const startResponse = await runsRoute.POST(request("/api/copilot/runs", "POST", {
    workflowKey: `${prefix}-customer-update`,
    workflowName: `${prefix} customer update`,
    idempotencyKey: `${prefix}-run`,
    approvalReason: "external_communication",
  }))
  const startEnvelope = await responseBody<{ created: boolean; run: ExecutionWorkflowRun }>(startResponse)
  const started = dataOf(startEnvelope)
  check("Copilot route persists an approval-gated run",
    startResponse.status === 201 && started.created && started.run.approvals[0]?.state === "pending")
  const approval = started.run.approvals[0]
  if (!approval) throw new Error("Approval-gated run has no approval")

  const executionBody = {
    actionKey: "recordAudit",
    agentKey: "business-os-owner-copilot",
    stepLabel: "Record owner-reviewed workflow run",
    toolName: "recordAudit",
    input: {
      workspaceId: ownerWorkspace.id,
      workflowKey: started.run.workflowKey,
      source: "business-os-p2-e2e",
    },
  }
  const executionState = async () => ({
    agents: await tx.agentRun.count({ where: { workflowRunId: started.run.id } }),
    steps: await tx.workflowStep.count({ where: { workflowRunId: started.run.id } }),
    tools: await tx.toolCall.count({ where: { workflowStep: { workflowRunId: started.run.id } } }),
    audits: await tx.copilotAuditEvent.count({ where: { workflowRunId: started.run.id } }),
  })
  const beforeBlockedExecution = JSON.stringify(await executionState())
  const blockedExecutionResponse = await executeRoute.POST(
    request(`/api/copilot/runs/${started.run.id}/execute`, "POST", executionBody),
    { params: Promise.resolve({ runId: started.run.id }) },
  )
  const blockedExecutionEnvelope = await responseBody(blockedExecutionResponse)
  check("pending approval blocks recordAudit execution",
    blockedExecutionResponse.status === 409
      && !blockedExecutionEnvelope.ok
      && blockedExecutionEnvelope.error.code === "APPROVAL_REQUIRED")
  check("blocked execution creates no agent, step, tool, or audit side effect",
    beforeBlockedExecution === JSON.stringify(await executionState()))

  const approvalResponse = await approvalRoute.POST(
    request(`/api/copilot/runs/${started.run.id}/approvals/${approval.id}`, "POST", {
      decision: "grant",
      note: "Owner approved the audit record.",
    }),
    { params: Promise.resolve({ runId: started.run.id, approvalId: approval.id }) },
  )
  check("owner can grant the pending approval", approvalResponse.status === 200)

  const executeResponse = await executeRoute.POST(
    request(`/api/copilot/runs/${started.run.id}/execute`, "POST", executionBody),
    { params: Promise.resolve({ runId: started.run.id }) },
  )
  const executeEnvelope = await responseBody<{
    replayed: boolean
    run: ExecutionWorkflowRun
    output: Readonly<{ recorded?: boolean }>
  }>(executeResponse)
  const executed = dataOf(executeEnvelope)
  check("approved server-owned recordAudit executes and completes",
    executeResponse.status === 200
      && !executed.replayed
      && executed.output.recorded === true
      && executed.run.state === "completed")

  const detailResponse = await detailRoute.GET(
    request(`/api/copilot/runs/${started.run.id}`),
    { params: Promise.resolve({ runId: started.run.id }) },
  )
  const detailEnvelope = await responseBody<{
    run: ExecutionWorkflowRun
    audit: readonly { sequence: number; eventType: string }[]
  }>(detailResponse)
  const detail = dataOf(detailEnvelope)
  check("Copilot detail returns contiguous persisted approval and tool audit records",
    detailResponse.status === 200
      && detail.audit.length > 0
      && detail.audit.some((event) => event.eventType === "approval.granted")
      && detail.audit.some((event) => event.eventType === "tool_call.completed")
      && detail.audit.every((event, index) => event.sequence === index + 1))

  const beforeCrossTenant = JSON.stringify(await executionState())
  copilotIdentity.current = foreignCopilotUser
  const foreignDetailResponse = await detailRoute.GET(
    request(`/api/copilot/runs/${started.run.id}`),
    { params: Promise.resolve({ runId: started.run.id }) },
  )
  const foreignDetailEnvelope = await responseBody(foreignDetailResponse)
  const missingRunId = `${prefix}-missing-run`
  const missingDetailResponse = await detailRoute.GET(
    request(`/api/copilot/runs/${missingRunId}`),
    { params: Promise.resolve({ runId: missingRunId }) },
  )
  const missingDetailEnvelope = await responseBody(missingDetailResponse)
  check("foreign Copilot run read is 404", foreignDetailResponse.status === 404 && !foreignDetailEnvelope.ok)
  check("foreign and missing Copilot run reads are indistinguishable",
    missingDetailResponse.status === 404
      && JSON.stringify(foreignDetailEnvelope) === JSON.stringify(missingDetailEnvelope))
  const foreignExecuteResponse = await executeRoute.POST(
    request(`/api/copilot/runs/${started.run.id}/execute`, "POST", executionBody),
    { params: Promise.resolve({ runId: started.run.id }) },
  )
  check("foreign Copilot execution is refused without leakage", foreignExecuteResponse.status === 404)
  check("foreign Copilot refusal has no execution side effect",
    beforeCrossTenant === JSON.stringify(await executionState()))

  check("P2 execution uses no external network provider", externalCalls === 0)
}

async function rollbackState(): Promise<Readonly<Record<string, number>>> {
  return Object.freeze({
    users: await prisma.user.count({ where: { clerkId: { startsWith: prefix } } }),
    profiles: await prisma.profile.count({ where: { slug: { contains: prefix } } }),
    workspaces: await prisma.workspace.count({ where: { slug: { contains: prefix } } }),
    memberships: await prisma.membership.count({ where: { userId: { startsWith: prefix } } }),
    contacts: await prisma.contact.count({ where: { email: { startsWith: prefix } } }),
    activities: await prisma.activityEvent.count({ where: { sourceId: { startsWith: prefix } } }),
    tasks: await prisma.taskJob.count({ where: { payload: { contains: prefix } } }),
    workflows: await prisma.workflowRun.count({ where: { idempotencyKey: { startsWith: prefix } } }),
    approvals: await prisma.approval.count({
      where: { workflowRun: { idempotencyKey: { startsWith: prefix } } },
    }),
    auditEvents: await prisma.copilotAuditEvent.count({
      where: { workflowRun: { idempotencyKey: { startsWith: prefix } } },
    }),
  })
}

async function main(): Promise<void> {
  const target = assertDisposableTarget(process.env.DATABASE_URL)
  if (target !== EXPECTED_DATABASE) throw new Error("DATABASE_URL is not the designated P2 rehearsal database")

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    externalCalls += 1
    throw new Error("External network access is forbidden in the P2 E2E")
  }

  try {
    try {
      await prisma.$transaction(async (tx) => {
        await runSuite(tx)
        throw new RollbackProof("rollback P2 Business OS E2E")
      }, { maxWait: 10_000, timeout: 120_000 })
    } catch (error) {
      if (!(error instanceof RollbackProof)) failures.push(`unexpected suite error: ${errorShape(error)}`)
    }

    const restoredRows = await rollbackState()
    check("transaction rollback restores zero P2 fixture rows",
      Object.values(restoredRows).every((count) => count === 0))

    console.log(JSON.stringify({
      result: failures.length === 0 ? "PASS" : "FAIL",
      inverted: invert,
      assertions: checks.length,
      coverage: [
        "canonical server-derived onboarding identity",
        "atomic Profile + Workspace + OWNER Membership provisioning",
        "authenticated/anonymous/foreign platform route boundaries",
        "persisted workspace/contact/activity/task reads",
        "approval-gated Prisma Copilot run",
        "server-owned recordAudit execution and append-only audit",
        "cross-tenant non-disclosure and zero refusal side effects",
        "no external provider calls",
        "transaction rollback to zero",
      ],
      externalCalls,
      restoredRows,
      failures,
    }, null, 2))
    if (failures.length > 0) process.exitCode = 1
  } finally {
    globalThis.fetch = originalFetch
  }
}

void main().finally(async () => prisma.$disconnect())
