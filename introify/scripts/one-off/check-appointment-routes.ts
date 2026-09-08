/**
 * Wave B / B4 appointment HTTP boundary harness.
 *
 * Invokes the REAL AppointmentApiService with a controlled identity and counting provider
 * stubs, asserting status, envelope and body for every principal class across every
 * endpoint. The routes themselves are thin re-exports over this service.
 *
 * Two negative claims are measured rather than asserted in prose:
 *   - a refusal writes nothing (row counts before/after)
 *   - a refusal reaches no external provider (invocation counters)
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-appointment-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { PersistedAppointments } from "../../src/lib/appointments/engine"
import { AppointmentApiService } from "../../src/lib/appointments/http"
import type {
    AppointmentProviders,
    DepositAuthorizationResult,
    NotificationProvider,
    PaymentProvider,
    ReminderDispatchResult,
} from "../../src/lib/appointments/providers"
import { AppointmentServices } from "../../src/lib/appointments/services"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wb4_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const BASE = "http://127.0.0.1/api/platform/appointments"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

class CountingPayments implements PaymentProvider {
    calls = 0
    private r(): DepositAuthorizationResult {
        this.calls += 1
        return Object.freeze({ outcome: "unavailable" as const, providerRef: null, failureCode: "STUB" })
    }
    async authorizeDeposit() { return this.r() }
    async captureDeposit() { return this.r() }
    async refundDeposit() { return this.r() }
}
class CountingNotifications implements NotificationProvider {
    calls = 0
    async dispatch(): Promise<ReminderDispatchResult> {
        this.calls += 1
        return Object.freeze({ outcome: "unavailable" as const, failureCode: "STUB" })
    }
}

type Seen = { status: number; body: unknown; text: string }
async function call(res: Promise<Response>): Promise<Seen> {
    const r = await res
    const text = await r.text()
    let body: unknown = null
    try { body = JSON.parse(text) } catch { body = null }
    return { status: r.status, body, text }
}

function asRecord(v: unknown): Record<string, unknown> {
    return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function pick(v: unknown, ...path: readonly string[]): unknown {
    let cur: unknown = v
    for (const k of path) cur = asRecord(cur)[k]
    return cur
}
function pickArray(v: unknown, ...path: readonly string[]): readonly unknown[] {
    const f = pick(v, ...path)
    return Array.isArray(f) ? f : []
}
function pickString(v: unknown, ...path: readonly string[]): string {
    const f = pick(v, ...path)
    return typeof f === "string" ? f : ""
}

const req = (url: string) => new Request(url)
const jsonReq = (url: string, payload: unknown, method = "POST") =>
    new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const tenancy = new PersistedTenancy(prisma, identity)
    const engine = new PersistedAppointments(prisma, tenancy)
    const payments = new CountingPayments()
    const notifications = new CountingNotifications()
    const providers: AppointmentProviders = Object.freeze({ payments, notifications })
    const api = new AppointmentApiService(engine, new AppointmentServices(prisma, tenancy, engine, providers))

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        svcA: `${RUN}_sa`, svcB: `${RUN}_sb`,
        resA: `${RUN}_ra`, resB: `${RUN}_rb`,
    }
    let baseBookings = 0
    let apptId = ""

    try {
        baseBookings = await prisma.booking.count()

        for (const [u, p, w, s, r] of [
            [ids.userA, ids.profileA, ids.wsA, ids.svcA, ids.resA],
            [ids.userB, ids.profileB, ids.wsB, ids.svcB, ids.resB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.serviceOffering.create({ data: { id: s, profileId: p, name: "Session" } })
            await prisma.appointmentResource.create({ data: { id: r, profileId: p, name: "Coach", capacity: 2 } })
            for (let d = 0; d < 7; d += 1) {
                await prisma.availabilitySchedule.create({
                    data: { profileId: p, dayOfWeek: d, startTime: "08:00", endTime: "20:00", isEnabled: true },
                })
            }
        }

        const payload = {
            workspaceId: ids.wsA,
            serviceOfferingId: ids.svcA,
            resourceId: ids.resA,
            startTime: "2035-01-08T10:00:00.000Z",
            endTime: "2035-01-08T11:00:00.000Z",
            visitorName: "Route Guest",
            visitorEmail: "rg@example.test",
        }

        // ---- 1. anonymous: 401 everywhere, zero writes, zero provider calls
        identity.current = null
        const before = await prisma.booking.count()
        const anonList = await call(api.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        const anonCreate = await call(api.create(jsonReq(BASE, payload)))
        const anonWaitlist = await call(api.joinWaitlist(jsonReq(`${BASE}/waitlist`, { ...payload, requestedStart: payload.startTime, requestedEnd: payload.endTime, guestName: "W" })))
        const anonAvail = await call(api.availability(req(`${BASE}/availability?workspaceId=${ids.wsA}&startTime=${payload.startTime}&endTime=${payload.endTime}`)))
        const anonResources = await call(api.resources(req(`${BASE}/resources?workspaceId=${ids.wsA}`)))
        const after = await prisma.booking.count()

        for (const [label, seen] of [["list", anonList], ["create", anonCreate], ["waitlist", anonWaitlist], ["availability", anonAvail], ["resources", anonResources]] as const) {
            check(`anonymous ${label} returns 401`, seen.status === 401, `status=${seen.status}`)
        }
        check("anonymous envelope is ok:false UNAUTHORIZED", pick(anonList.body, "ok") === false && pickString(anonList.body, "error", "code") === "UNAUTHORIZED", anonList.text)
        check("anonymous response carries no data payload", pick(anonList.body, "data") === undefined, anonList.text.slice(0, 100))
        check("anonymous writes nothing", before === after, `before=${before} after=${after}`)
        check("anonymous reaches no payment provider", payments.calls === 0, `calls=${payments.calls}`)
        check("anonymous reaches no notification provider", notifications.calls === 0, `calls=${notifications.calls}`)

        // ---- 2. valid owner ------------------------------------------------
        identity.current = `clerk_${ids.userA}`
        const created = await call(api.create(jsonReq(BASE, { ...payload, idempotencyKey: "r1" })))
        check("owner create returns 201", created.status === 201, `status=${created.status}`)
        apptId = pickString(created.body, "data", "appointment", "id")
        check("owner create returns an id", apptId.length > 0, `id=${apptId}`)
        check("dates serialise as ISO", pickString(created.body, "data", "appointment", "startTime") === payload.startTime, pickString(created.body, "data", "appointment", "startTime"))

        const replay = await call(api.create(jsonReq(BASE, { ...payload, idempotencyKey: "r1" })))
        check("idempotent replay returns 200 not 201", replay.status === 200, `status=${replay.status}`)
        check("replay is flagged", pick(replay.body, "data", "replayed") === true, String(pick(replay.body, "data", "replayed")))

        const ownerList = await call(api.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        check("owner list returns 200 with one row", ownerList.status === 200 && pickArray(ownerList.body, "data", "appointments").length === 1, `count=${pickArray(ownerList.body, "data", "appointments").length}`)

        const avail = await call(api.availability(req(`${BASE}/availability?workspaceId=${ids.wsA}&startTime=2035-01-09T10:00:00.000Z&endTime=2035-01-09T11:00:00.000Z`)))
        check("availability returns 200 and reports available", avail.status === 200 && pick(avail.body, "data", "available") === true, avail.text.slice(0, 120))
        const availOutside = await call(api.availability(req(`${BASE}/availability?workspaceId=${ids.wsA}&startTime=2035-01-09T05:00:00.000Z&endTime=2035-01-09T06:00:00.000Z`)))
        check("availability reports unavailable with a reason outside hours", pick(availOutside.body, "data", "available") === false && pickString(availOutside.body, "data", "reason").length > 0, availOutside.text.slice(0, 140))

        const resources = await call(api.resources(req(`${BASE}/resources?workspaceId=${ids.wsA}`)))
        check("resources returns 200 with the tenant's resource", resources.status === 200 && pickArray(resources.body, "data", "resources").length === 1, `count=${pickArray(resources.body, "data", "resources").length}`)

        // ---- 3. wrong tenant: 403, indistinguishable from missing ---------
        identity.current = `clerk_${ids.userB}`
        const foreign = await call(api.get(apptId, req(`${BASE}/${apptId}?workspaceId=${ids.wsB}`)))
        const missing = await call(api.get(`${RUN}_nope`, req(`${BASE}/${RUN}_nope?workspaceId=${ids.wsB}`)))
        check("wrong-tenant get returns 403", foreign.status === 403, `status=${foreign.status}`)
        check("nonexistent get returns 403", missing.status === 403, `status=${missing.status}`)
        // This is the single inverted assertion.
        check(
            "foreign and nonexistent bodies are BYTE-IDENTICAL",
            INVERT ? foreign.text !== missing.text : foreign.text === missing.text,
            `foreign=${foreign.text} missing=${missing.text}`,
        )
        const foreignList = await call(api.list(req(`${BASE}?workspaceId=${ids.wsB}`)))
        check("wrong-tenant list is 200 and empty", foreignList.status === 200 && pickArray(foreignList.body, "data", "appointments").length === 0, `count=${pickArray(foreignList.body, "data", "appointments").length}`)

        const stBefore = (await prisma.booking.findUnique({ where: { id: apptId } }))?.status
        const foreignPatch = await call(api.transition(apptId, jsonReq(`${BASE}/${apptId}`, { workspaceId: ids.wsB, status: "CANCELLED" }, "PATCH")))
        const stAfter = (await prisma.booking.findUnique({ where: { id: apptId } }))?.status
        check("wrong-tenant PATCH returns 403", foreignPatch.status === 403, `status=${foreignPatch.status}`)
        check("refused PATCH changed nothing", stBefore === stAfter, `${stBefore} -> ${stAfter}`)

        const foreignDeposit = await call(api.requireDeposit(apptId, jsonReq(`${BASE}/${apptId}/deposit`, { workspaceId: ids.wsB, amountCents: 5000 })))
        const foreignReminder = await call(api.scheduleReminder(apptId, jsonReq(`${BASE}/${apptId}/reminders`, { workspaceId: ids.wsB, channel: "EMAIL", sendAt: "2035-01-07T10:00:00.000Z" })))
        check("wrong-tenant deposit returns 403", foreignDeposit.status === 403, `status=${foreignDeposit.status}`)
        check("wrong-tenant reminder returns 403", foreignReminder.status === 403, `status=${foreignReminder.status}`)
        const depRows = await prisma.appointmentDeposit.count()
        const remRows = await prisma.appointmentReminder.count()
        check("wrong-tenant deposit wrote no row", depRows === 0, `rows=${depRows}`)
        check("wrong-tenant reminder wrote no row", remRows === 0, `rows=${remRows}`)
        check("no provider was reached by any refusal", payments.calls === 0 && notifications.calls === 0, `pay=${payments.calls} notify=${notifications.calls}`)

        // ---- 4. malformed input is 400 -----------------------------------
        identity.current = `clerk_${ids.userA}`
        check("missing workspaceId returns 400", (await call(api.list(req(BASE)))).status === 400)
        const badJson = await call(api.create(new Request(BASE, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" })))
        check("malformed JSON returns 400", badJson.status === 400, `status=${badJson.status}`)
        const badStatus = await call(api.transition(apptId, jsonReq(`${BASE}/${apptId}`, { workspaceId: ids.wsA, status: "TELEPORTED" }, "PATCH")))
        check("unrecognised status returns 400", badStatus.status === 400, `status=${badStatus.status}`)
        const badChannel = await call(api.scheduleReminder(apptId, jsonReq(`${BASE}/${apptId}/reminders`, { workspaceId: ids.wsA, channel: "PIGEON", sendAt: "2035-01-07T10:00:00.000Z" })))
        check("unrecognised reminder channel returns 400", badChannel.status === 400, `status=${badChannel.status}`)
        const badDepositState = await call(api.transitionDeposit(apptId, jsonReq(`${BASE}/${apptId}/deposit`, { workspaceId: ids.wsA, state: "MAGIC" }, "PATCH")))
        check("unrecognised deposit state returns 400", badDepositState.status === 400, `status=${badDepositState.status}`)

        // ---- 5. conflict is 409 ------------------------------------------
        const overlap = await call(api.create(jsonReq(BASE, { ...payload, startTime: "2035-01-08T10:30:00.000Z", endTime: "2035-01-08T11:30:00.000Z" })))
        check("overlapping create returns 409", overlap.status === 409, `status=${overlap.status} body=${overlap.text.slice(0, 90)}`)
        const illegal = await call(api.transition(apptId, jsonReq(`${BASE}/${apptId}`, { workspaceId: ids.wsA, status: "COMPLETED" }, "PATCH")))
        check("illegal transition returns 409", illegal.status === 409, `status=${illegal.status}`)
        const overCapacity = await call(api.create(jsonReq(BASE, { ...payload, startTime: "2035-01-10T10:00:00.000Z", endTime: "2035-01-10T11:00:00.000Z", partySize: 99 })))
        check("over-capacity create returns 409", overCapacity.status === 409, `status=${overCapacity.status}`)

        // ---- 6. deposit + reminder happy paths ---------------------------
        const dep = await call(api.requireDeposit(apptId, jsonReq(`${BASE}/${apptId}/deposit`, { workspaceId: ids.wsA, amountCents: 5000 })))
        check("deposit requirement returns 201 in REQUIRED", dep.status === 201 && pickString(dep.body, "data", "deposit", "state") === "REQUIRED", `status=${dep.status} state=${pickString(dep.body, "data", "deposit", "state")}`)
        check("recording a deposit requirement calls no provider", payments.calls === 0, `calls=${payments.calls}`)

        const depGet = await call(api.getDeposit(apptId, req(`${BASE}/${apptId}/deposit?workspaceId=${ids.wsA}`)))
        check("deposit GET returns 200 with the recorded state", depGet.status === 200 && pickString(depGet.body, "data", "deposit", "state") === "REQUIRED", `status=${depGet.status} state=${pickString(depGet.body, "data", "deposit", "state")}`)

        identity.current = `clerk_${ids.userB}`
        const depGetForeign = await call(api.getDeposit(apptId, req(`${BASE}/${apptId}/deposit?workspaceId=${ids.wsB}`)))
        check("wrong-tenant deposit GET returns 403", depGetForeign.status === 403, `status=${depGetForeign.status}`)
        identity.current = `clerk_${ids.userA}`

        const rem = await call(api.scheduleReminder(apptId, jsonReq(`${BASE}/${apptId}/reminders`, { workspaceId: ids.wsA, channel: "EMAIL", sendAt: "2035-01-07T10:00:00.000Z" })))
        check("reminder schedule returns 201 SCHEDULED", rem.status === 201 && pickString(rem.body, "data", "reminder", "state") === "SCHEDULED", `status=${rem.status}`)
        const remReplay = await call(api.scheduleReminder(apptId, jsonReq(`${BASE}/${apptId}/reminders`, { workspaceId: ids.wsA, channel: "EMAIL", sendAt: "2035-01-07T10:00:00.000Z" })))
        check("reminder replay returns 200", remReplay.status === 200 && pick(remReplay.body, "data", "replayed") === true, `status=${remReplay.status}`)
        const remList = await call(api.listReminders(apptId, req(`${BASE}/${apptId}/reminders?workspaceId=${ids.wsA}`)))
        check("reminder list returns exactly one", pickArray(remList.body, "data", "reminders").length === 1, `count=${pickArray(remList.body, "data", "reminders").length}`)
        check("scheduling a reminder sent nothing", notifications.calls === 0, `calls=${notifications.calls}`)

        // ---- 7. waitlist over HTTP --------------------------------------
        const join = await call(api.joinWaitlist(jsonReq(`${BASE}/waitlist`, {
            workspaceId: ids.wsA, serviceOfferingId: ids.svcA, resourceId: ids.resA,
            requestedStart: "2035-02-05T10:00:00.000Z", requestedEnd: "2035-02-05T11:00:00.000Z",
            guestName: "Waiter", idempotencyKey: "wl1",
        })))
        check("waitlist join returns 201", join.status === 201, `status=${join.status}`)
        const entryId = pickString(join.body, "data", "entry", "id")
        const wlList = await call(api.listWaitlist(req(`${BASE}/waitlist?workspaceId=${ids.wsA}`)))
        check("waitlist list returns the entry", pickArray(wlList.body, "data", "entries").length === 1, `count=${pickArray(wlList.body, "data", "entries").length}`)

        const promote = await call(api.promoteWaitlist(entryId, jsonReq(`${BASE}/waitlist/${entryId}/promote`, { workspaceId: ids.wsA })))
        check("waitlist promotion returns 200 with a booking", promote.status === 200 && pickString(promote.body, "bookingId").length + pickString(promote.body, "data", "bookingId").length > 0, `status=${promote.status} body=${promote.text.slice(0, 120)}`)

        identity.current = `clerk_${ids.userB}`
        const foreignPromote = await call(api.promoteWaitlist(entryId, jsonReq(`${BASE}/waitlist/${entryId}/promote`, { workspaceId: ids.wsB })))
        check("wrong-tenant promotion returns 403", foreignPromote.status === 403, `status=${foreignPromote.status}`)

        // ---- 8. dependency failure is 503 with no internal detail -------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: { findUnique: async () => { throw new Error("SECRET_DETAIL postgres://u:p@h/d") } },
        } as unknown as PrismaClient
        const brokenTenancy = new PersistedTenancy(prisma, identity)
        const brokenEngine = new PersistedAppointments(brokenPrisma, brokenTenancy)
        const brokenApi = new AppointmentApiService(
            brokenEngine,
            new AppointmentServices(brokenPrisma, brokenTenancy, brokenEngine, providers),
        )
        const broken = await call(brokenApi.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        check("dependency failure returns 503", broken.status === 503, `status=${broken.status}`)
        check("dependency failure leaks no internal detail", !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text), broken.text.slice(0, 120))

        // ---- 9. envelope agrees with PlatformService --------------------
        check("success envelope keys are exactly ok,data", Object.keys(asRecord(created.body)).sort().join(",") === "data,ok", Object.keys(asRecord(created.body)).sort().join(","))
        check("error envelope keys are exactly error,ok", Object.keys(asRecord(anonList.body)).sort().join(",") === "error,ok", Object.keys(asRecord(anonList.body)).sort().join(","))

        // ---- 10. final provider tally ---------------------------------
        check("no external provider was EVER invoked in this run", payments.calls === 0 && notifications.calls === 0, `pay=${payments.calls} notify=${notifications.calls}`)
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "AppointmentEvent" disable trigger "AppointmentEvent_append_only"`)
            await prisma.$executeRawUnsafe(`delete from "AppointmentEvent" where "bookingId" in (select "id" from "Booking" where "profileId" in ('${ids.profileA}','${ids.profileB}'))`)
        } finally {
            await prisma.$executeRawUnsafe(`alter table "AppointmentEvent" enable trigger "AppointmentEvent_append_only"`)
        }
        for (const sql of [
            `delete from "AppointmentReminder" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentDeposit" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentWaitlistEntry" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "Booking" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentResource" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AvailabilitySchedule" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "ServiceOffering" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }
        const endB = await prisma.booking.count()
        check("booking rows returned to baseline", endB === baseBookings, `baseline=${baseBookings} end=${endB}`)
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All appointment route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
