import { businessBlueprintRegistry, validateBusinessBlueprint } from "../../src/lib/business-os"
import { surfacesFor, writeExtras } from "../../src/lib/surfaces"
import {
  createBusinessOsRoute,
  createFakeAuthSession,
  createFakeSurfaceEntitlements,
  invokeRoute,
} from "../../src/lib/testing/auth-fakes"

const failures: string[] = []

function check(name: string, condition: boolean): void {
  if (!condition) failures.push(name)
}

async function responseFor(roleTemplate: string | null, personalityConfig?: string | null) {
  return invokeRoute(createBusinessOsRoute(
    createFakeAuthSession({
      userId: "user-deterministic",
      profiles: [{ id: "tenant-a", roleTemplate, personalityConfig }],
    }),
    createFakeSurfaceEntitlements(),
  ))
}

async function main() {
  const unauthenticated = await invokeRoute(createBusinessOsRoute(
    createFakeAuthSession(null),
    createFakeSurfaceEntitlements(),
  ))
  const invert = process.env.INVERT_ASSERTION === "1"
  check(
    "unauthenticated request returns the 401 UNAUTHORIZED envelope",
    invert
      ? unauthenticated.status !== 401 || unauthenticated.body.error?.code !== "UNAUTHORIZED"
      : unauthenticated.status === 401 && unauthenticated.body.ok === false && unauthenticated.body.error?.code === "UNAUTHORIZED",
  )

  const authenticatedWithoutSurface = await responseFor("RESTAURANT")
  check(
    "authenticated user without businessOs returns 403 FORBIDDEN, not 401",
    authenticatedWithoutSurface.status === 403
      && authenticatedWithoutSurface.body.ok === false
      && authenticatedWithoutSurface.body.error?.code === "FORBIDDEN",
  )

  for (const role of ["CUSTOM", "UNKNOWN_ROLE", null, ""] as const) {
    const response = await responseFor(role)
    check(`${String(role)} is denied Business OS by default`, response.status === 403 && response.body.error?.code === "FORBIDDEN")
  }

  const defaultCustomSurfaces = surfacesFor("CUSTOM")
  check("businessOs is absent from ALL_SURFACES for CUSTOM", !defaultCustomSurfaces.includes("businessOs"))

  const explicitOptIn = writeExtras(null, { surfaces: ["businessOs"] })
  const optInResponse = await responseFor("CUSTOM", explicitOptIn)
  check("businessOs requires explicit extras opt-in", optInResponse.status === 200 && optInResponse.body.ok === true)

  const template = businessBlueprintRegistry[0]
  const invalidApproval = {
    ...template,
    workflows: template.workflows.map((workflow) => ({
      ...workflow,
      actions: workflow.actions.map((action) => action.approval
        ? { ...action, approval: { ...action.approval, reason: "   " } }
        : { ...action }),
    })),
  }
  const validation = validateBusinessBlueprint(invalidApproval)
  check(
    "blank required approval reasons are rejected",
    !validation.ok && validation.issues.some((issue) => issue.path.endsWith("approval.reason")),
  )

  const report = {
    result: failures.length === 0 ? "PASS" : "FAIL",
    assertions: [
      "401 unauthenticated envelope",
      "403 authenticated without businessOs",
      "CUSTOM, unknown, null, and empty roles denied",
      "businessOs omitted from ALL_SURFACES and explicit extras opt-in required",
      "blank approval reason rejected",
    ],
    failures,
  }
  console.log(JSON.stringify(report, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main()
