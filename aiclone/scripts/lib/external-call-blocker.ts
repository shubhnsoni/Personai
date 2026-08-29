/**
 * Blocks and COUNTS outbound network calls, installed at IMPORT time.
 *
 * WHY THIS IS A MODULE AND NOT FIVE LINES AT THE TOP OF A HARNESS
 *
 * W3's audit of the Wave G4 harnesses (finding 8) established that
 * check-fieldjob-runtime.ts installed its blocker in top-level statements that ran AFTER its
 * `import` declarations. ES module and ts-node CommonJS semantics both evaluate imported modules
 * before the importing module's own body, so every module under test had already been evaluated -
 * and could already have called out - by the time the blocker existed. The harness then asserted
 * "zero external calls were made", which was true of the window it was watching and not of the
 * whole run.
 *
 * Importing this module FIRST fixes that at the cause: its side effect runs before the later
 * imports in the importing file are evaluated. The harness asserts the ordering structurally, so
 * it cannot silently regress.
 *
 * WHAT IT COVERS, and what that lets a harness honestly claim (W3 finding 9)
 *
 *   global fetch                  - the path Next.js server code and most SDKs use
 *   node:http  request / get      - the path an older SDK or a raw client would use
 *   node:https request / get      - likewise, and the one a real provider call would take
 *
 * That is broad enough that "no real external call was made" is a claim about the process rather
 * than about one function. It is still not a kernel-level guarantee: a dependency holding a
 * reference captured before this module loaded, a raw net.Socket, a DNS lookup, or a child process
 * would not be seen. A harness using this should say "no HTTP(S) or fetch call" rather than "no
 * network activity whatsoever", because the second is not what is being measured.
 *
 * Postgres is deliberately unaffected: Prisma speaks the wire protocol over a TCP socket, not
 * HTTP, so blocking these three surfaces does not interfere with the database the harness needs.
 */
import http from "node:http"
import https from "node:https"

type Counted = { via: string; target: string }

const calls: Counted[] = []

const realFetch = globalThis.fetch
const realHttpRequest = http.request
const realHttpGet = http.get
const realHttpsRequest = https.request
const realHttpsGet = https.get

function record(via: string, target: string): never {
    calls.push({ via, target })
    throw new Error(`BLOCKED external call via ${via}: ${target}`)
}

function describe(arg: unknown): string {
    if (typeof arg === "string") return arg
    if (arg instanceof URL) return arg.toString()
    if (arg && typeof arg === "object" && "url" in arg) return String((arg as { url: unknown }).url)
    if (arg && typeof arg === "object" && "host" in arg) return String((arg as { host: unknown }).host)
    return "<unknown target>"
}

globalThis.fetch = (async (...args: unknown[]) => record("fetch", describe(args[0]))) as unknown as typeof globalThis.fetch

// The overloads differ between request and get only in defaults, so one shim serves both.
const shim = (via: string) =>
    ((...args: unknown[]) => record(via, describe(args[0]))) as unknown as typeof http.request

http.request = shim("http.request")
http.get = shim("http.get")
https.request = shim("https.request") as unknown as typeof https.request
https.get = shim("https.get") as unknown as typeof https.get

/** How many outbound calls were attempted. A harness asserts this is zero. */
export function externalCallCount(): number {
    return calls.length
}

/** What was attempted, for a failure message that names the offender. */
export function externalCallLog(): readonly string[] {
    return calls.map((c) => `${c.via} -> ${c.target}`)
}

/** Restores every patched surface. Call in a finally block. */
export function restoreExternalCalls(): void {
    globalThis.fetch = realFetch
    http.request = realHttpRequest
    http.get = realHttpGet
    https.request = realHttpsRequest
    https.get = realHttpsGet
}

/** Proof for the harness that installation actually happened, rather than being assumed. */
export const EXTERNAL_CALL_BLOCKER_INSTALLED = true
