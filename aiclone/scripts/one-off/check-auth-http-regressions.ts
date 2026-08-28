import { randomBytes } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { connect } from "node:net"
import { once } from "node:events"
import { createRequire } from "node:module"

import { createRouteMatcher } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"

import { GET as healthGet } from "../../src/app/api/health/route"
import { PROTECTED_ROUTE_PATTERNS } from "../../src/middleware"
import { assertDisposableTarget } from "../lib/disposable-db"
import {
  createBusinessOsRoute,
  createFakeAuthSession,
  createFakeSurfaceEntitlements,
  type RouteHandler,
} from "../../src/lib/testing/auth-fakes"

type Recorded = {
  name: string
  passed: boolean
}

type MiddlewareRequest = {
  url: string
}

type MiddlewareHandler = (request: MiddlewareRequest) => Promise<Response | undefined>

const results: Recorded[] = []
const invert = process.env.INVERT_ASSERTION === "1"

function check(name: string, condition: boolean): void {
  results.push({ name, passed: condition })
}

function expected(condition: boolean): boolean {
  return invert ? !condition : condition
}

function responseHeaders(response: Response): Record<string, string> {
  return Object.fromEntries(response.headers.entries())
}

async function relay(response: Response, serverResponse: ServerResponse): Promise<void> {
  serverResponse.writeHead(response.status, responseHeaders(response))
  serverResponse.end(Buffer.from(await response.arrayBuffer()))
}

function nextHeaders(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "))
    else if (value !== undefined) headers.set(name, value)
  }
  return headers
}

function requestUrl(request: IncomingMessage, port: number): URL {
  return new URL(request.url ?? "/", `http://127.0.0.1:${port}`)
}

const localRequire = createRequire(__filename)

function loadMiddlewareWithClerkDouble(): MiddlewareHandler {
  const clerkModuleId = localRequire.resolve("@clerk/nextjs/server")
  const middlewareModuleId = localRequire.resolve("../../src/middleware")
  const clerkCache = localRequire.cache[clerkModuleId]
  if (!clerkCache) throw new Error("Clerk middleware module was not loaded")

  const originalExports = clerkCache.exports
  const strictRouteMatcher = (patterns: string[]) => (request: MiddlewareRequest): boolean => {
    const pathname = new URL(request.url).pathname
    return patterns.some((pattern) => {
      const base = pattern.endsWith("(.*)") ? pattern.slice(0, -4).replace(/\/$/u, "") : pattern
      return pathname === base || pathname.startsWith(`${base}/`)
    })
  }

  clerkCache.exports = {
    ...originalExports,
    clerkMiddleware: (handler: (auth: { protect: (options?: { unauthenticatedUrl?: string }) => Promise<void> }, request: MiddlewareRequest) => Promise<void>) => {
      return async (request: MiddlewareRequest): Promise<Response> => {
        let protection: Response | undefined
        await handler({
          protect: async (options) => {
            const target = options?.unauthenticatedUrl
            if (!target) return
            protection = new Response(null, { status: 307, headers: { location: target } })
          },
        }, request)
        return protection ?? new Response("content shell", { status: 200 })
      }
    },
    createRouteMatcher: strictRouteMatcher,
  }

  delete localRequire.cache[middlewareModuleId]
  const loaded = localRequire("../../src/middleware") as { default: MiddlewareHandler }
  clerkCache.exports = originalExports
  delete localRequire.cache[middlewareModuleId]
  return loaded.default
}

function portIsClear(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port })
    socket.once("connect", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => resolve(true))
  })
}

async function main(): Promise<void> {
  process.loadEnvFile(".env")
  assertDisposableTarget(process.env.DATABASE_URL)

  const previousDiagnosticToken = process.env.HEALTH_DIAGNOSTICS_TOKEN
  const diagnosticToken = randomBytes(32).toString("hex")
  process.env.HEALTH_DIAGNOSTICS_TOKEN = diagnosticToken

  const middleware = loadMiddlewareWithClerkDouble()
  const unauthenticatedBusinessOs = createBusinessOsRoute(
    createFakeAuthSession(null),
    createFakeSurfaceEntitlements(),
  )
  const forbiddenBusinessOs = createBusinessOsRoute(
    createFakeAuthSession({
      userId: "deterministic-user",
      profiles: [{ id: "deterministic-profile", roleTemplate: "RESTAURANT" }],
    }),
    createFakeSurfaceEntitlements(),
  )

  let port = 0
  const server = createServer(async (request, response) => {
    try {
      const url = requestUrl(request, port)
      if (url.pathname === "/api/health") {
        await relay(await healthGet(new NextRequest(url, { headers: nextHeaders(request) })), response)
        return
      }

      if (url.pathname === "/api/business-os/blueprints") {
        const route: RouteHandler = request.headers["x-test-authenticated"] === "1"
          ? forbiddenBusinessOs
          : unauthenticatedBusinessOs
        await relay(await route(new Request(url)), response)
        return
      }

      const middlewareResponse = await middleware({ url: url.toString() })
      if (!middlewareResponse) throw new Error("Middleware double returned no response")
      await relay(middlewareResponse, response)
    } catch {
      response.writeHead(500)
      response.end()
    }
  })

  try {
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Loopback server did not expose a TCP port")
    port = address.port

    const publicHealth = await fetch(`http://127.0.0.1:${port}/api/health`)
    check("public health returns 200", publicHealth.status === 200)
    check(
      "public health exposes only minimal liveness",
      JSON.stringify(await publicHealth.json()) === JSON.stringify({ status: "ok" }),
    )

    const rejectedDetails = await fetch(`http://127.0.0.1:${port}/api/health?details=1`)
    check("unauthorized health diagnostics fail closed with 200", rejectedDetails.status === 200)
    check(
      "unauthorized health diagnostics expose only minimal liveness",
      JSON.stringify(await rejectedDetails.json()) === JSON.stringify({ status: "ok" }),
    )

    const detailedHealth = await fetch(`http://127.0.0.1:${port}/api/health?details=1`, {
      headers: { "x-health-diagnostics-token": diagnosticToken },
    })
    const detailedBody = await detailedHealth.json() as { status?: string; database?: string }
    check("operator diagnostics use a sanitized categorical database result", [200, 503].includes(detailedHealth.status)
      && (detailedBody.status === "ok" || detailedBody.status === "degraded")
      && (detailedBody.database === "ok" || detailedBody.database === "unavailable")
      && Object.keys(detailedBody).sort().join(",") === "database,status")

    const dashboard = await fetch(`http://127.0.0.1:${port}/dashboard`, { redirect: "manual" })
    const dashboardChild = await fetch(`http://127.0.0.1:${port}/dashboard/x`, { redirect: "manual" })
    const dashboardLookalike = await fetch(`http://127.0.0.1:${port}/dashboardfoo`, { redirect: "manual" })
    const publicRoute = await fetch(`http://127.0.0.1:${port}/public`, { redirect: "manual" })
    check("signed-out dashboard redirects to sign-in with 307", dashboard.status === 307
      && new URL(dashboard.headers.get("location") ?? "", `http://127.0.0.1:${port}`).pathname === "/sign-in")
    check("signed-out dashboard child redirects to sign-in with 307", dashboardChild.status === 307)
    check("dashboard lookalike remains public", dashboardLookalike.status === 200)
    check("public route remains 200", publicRoute.status === 200)

    // Assert against the REAL exported patterns, never a hard-coded copy.
    // A local copy is what made this check unpassable before: it hard-coded
    // "/dashboard(.*)" and then asserted that pattern does not match
    // "/dashboardfoo", which is self-contradictory.
    const realDashboardMatcher = createRouteMatcher([...PROTECTED_ROUTE_PATTERNS])
    check("installed Clerk matcher does not gate dashboard lookalikes", !realDashboardMatcher(new NextRequest("http://127.0.0.1/dashboardfoo")))
    check("installed Clerk matcher gates dashboard root", realDashboardMatcher(new NextRequest("http://127.0.0.1/dashboard")))
    check("installed Clerk matcher gates dashboard descendants", realDashboardMatcher(new NextRequest("http://127.0.0.1/dashboard/x")))
    check("installed Clerk matcher does not gate onboarding lookalikes", !realDashboardMatcher(new NextRequest("http://127.0.0.1/onboardingfoo")))
    check("installed Clerk matcher gates onboarding root", realDashboardMatcher(new NextRequest("http://127.0.0.1/onboarding")))
    check("installed Clerk matcher does not gate admin lookalikes", !realDashboardMatcher(new NextRequest("http://127.0.0.1/adminfoo")))
    check("installed Clerk matcher gates admin root", realDashboardMatcher(new NextRequest("http://127.0.0.1/admin")))

    const unauthenticatedApi = await fetch(`http://127.0.0.1:${port}/api/business-os/blueprints`)
    const unauthenticatedBody = await unauthenticatedApi.json() as { ok?: boolean; error?: { code?: string } }
    check("Business OS API unauthenticated response is 401 UNAUTHORIZED", unauthenticatedApi.status === 401
      && unauthenticatedBody.ok === false && unauthenticatedBody.error?.code === "UNAUTHORIZED")

    const forbiddenApi = await fetch(`http://127.0.0.1:${port}/api/business-os/blueprints`, {
      headers: { "x-test-authenticated": "1" },
    })
    const forbiddenBody = await forbiddenApi.json() as { ok?: boolean; error?: { code?: string } }
    check("authenticated caller without Business OS surface receives 403 FORBIDDEN", forbiddenApi.status === 403
      && forbiddenBody.ok === false && forbiddenBody.error?.code === "FORBIDDEN")

    check("inversion control", expected(true))
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    if (previousDiagnosticToken === undefined) delete process.env.HEALTH_DIAGNOSTICS_TOKEN
    else process.env.HEALTH_DIAGNOSTICS_TOKEN = previousDiagnosticToken
  }

  check("temporary loopback server port is clear after shutdown", await portIsClear(port))
  const failures = results.filter((result) => !result.passed).map((result) => result.name)
  console.log(JSON.stringify({
    result: failures.length === 0 ? "PASS" : "FAIL",
    inversion: invert,
    portCleared: true,
    failures,
  }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main()
