/**
 * Wave A / A3 reservation HTTP boundary harness.
 *
 * Invokes the REAL ReservationService with a controlled identity and asserts the
 * response envelope, status code and body for every principal class. This is route
 * boundary evidence: it exercises the same code path the App Router calls.
 *
 * The routes themselves are three-line re-exports over this service, matching the
 * pattern /api/platform/tasks already uses.
 *
 * Also asserts the envelope agrees with PlatformService's contract, so the
 * deliberately-restated helpers in reservations/service.ts cannot silently drift.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-reservation-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { PersistedReservations } from "../../src/lib/reservations/engine"
import { ReservationService } from "../../src/lib/reservations/service"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wa3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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

type Seen = { status: number; body: unknown; text: string }

/** Typed navigation into an unknown JSON body, so the harness needs no `any`. */
function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function pick(value: unknown, ...path: readonly string[]): unknown {
    let current: unknown = value
    for (const key of path) current = asRecord(current)[key]
    return current
}

function pickArray(value: unknown, ...path: readonly string[]): readonly unknown[] {
    const found = pick(value, ...path)
    return Array.isArray(found) ? found : []
}

function pickString(value: unknown, ...path: readonly string[]): string {
    const found = pick(value, ...path)
    return typeof found === "string" ? found : ""
}

async function call(res: Promise<Response>): Promise<Seen> {
    const r = await res
    const text = await r.text()
    let body: unknown = null
    try {
        body = JSON.parse(text)
    } catch {
        body = null
    }
    return { status: r.status, body, text }
}

function req(url: string): Request {
    return new Request(url)
}

function jsonReq(url: string, payload: unknown): Request {
    return new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    })
}

const BASE = "http://127.0.0.1/api/platform/reservations"

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
    const service = new ReservationService(
        new PersistedReservations(prisma, new PersistedTenancy(prisma, identity)),
    )

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`,
        userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`,
        profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`,
        wsB: `${RUN}_wb`,
        tableA: `${RUN}_ta`,
    }

    let baseReservations = 0

    try {
        baseReservations = await prisma.reservation.count()

        for (const [u, p, w] of [
            [ids.userA, ids.profileA, ids.wsA],
            [ids.userB, ids.profileB, ids.wsB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `V ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
        }
        await prisma.restaurantTable.create({
            data: { id: ids.tableA, profileId: ids.profileA, label: "T1", code: `code_${ids.tableA}`, seats: 6 },
        })

        const payload = {
            workspaceId: ids.wsA,
            tableId: ids.tableA,
            partySize: 4,
            startAt: "2031-08-01T18:00:00.000Z",
            endAt: "2031-08-01T20:00:00.000Z",
            guestName: "Route Guest",
        }

        // ---- 1. anonymous: 401 with a structural envelope and NO data --------
        identity.current = null
        const beforeAnon = await prisma.reservation.count()
        const anonList = await call(service.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        const anonPost = await call(service.create(jsonReq(BASE, payload)))
        const afterAnon = await prisma.reservation.count()

        check("anonymous GET returns 401", anonList.status === 401, `status=${anonList.status}`)
        check("anonymous POST returns 401", anonPost.status === 401, `status=${anonPost.status}`)
        check(
            "anonymous GET envelope is ok:false with UNAUTHORIZED",
            pick(anonList.body, "ok") === false && pickString(anonList.body, "error", "code") === "UNAUTHORIZED",
            anonList.text,
        )
        check(
            "anonymous response carries NO data payload",
            pick(anonList.body, "data") === undefined && !/reservations/.test(anonList.text),
            anonList.text.slice(0, 120),
        )
        check("anonymous POST wrote zero rows", beforeAnon === afterAnon, `before=${beforeAnon} after=${afterAnon}`)

        // ---- 2. valid owner: 201 then 200 ----------------------------------
        identity.current = `clerk_${ids.userA}`
        const created = await call(service.create(jsonReq(BASE, { ...payload, idempotencyKey: "route-k1" })))
        check("owner POST returns 201", created.status === 201, `status=${created.status}`)
        check("owner POST envelope is ok:true", pick(created.body, "ok") === true, created.text.slice(0, 140))
        const createdId = pickString(created.body, "data", "reservation", "id")
        check("owner POST returned a reservation id", createdId.length > 0, `id=${createdId}`)
        check(
            "owner POST serialised dates as ISO strings",
            pickString(created.body, "data", "reservation", "startAt") === "2031-08-01T18:00:00.000Z",
            pickString(created.body, "data", "reservation", "startAt"),
        )

        const ownerList = await call(service.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        check("owner GET returns 200", ownerList.status === 200, `status=${ownerList.status}`)
        check(
            "owner GET lists exactly one reservation",
            pickArray(ownerList.body, "data", "reservations").length === 1,
            `count=${pickArray(ownerList.body, "data", "reservations").length}`,
        )

        // ---- 3. idempotent replay answers 200, not 201 ---------------------
        const replay = await call(service.create(jsonReq(BASE, { ...payload, idempotencyKey: "route-k1" })))
        check("idempotent replay returns 200 not 201", replay.status === 200, `status=${replay.status}`)
        check("idempotent replay is flagged", pick(replay.body, "data", "replayed") === true, String(pick(replay.body, "data", "replayed")))

        // ---- 4. wrong tenant: 403, byte-identical to nonexistent ----------
        identity.current = `clerk_${ids.userB}`
        const foreign = await call(service.get(createdId, req(`${BASE}/${createdId}?workspaceId=${ids.wsB}`)))
        const missing = await call(service.get(`${RUN}_nope`, req(`${BASE}/${RUN}_nope?workspaceId=${ids.wsB}`)))
        check("wrong-tenant GET returns 403", foreign.status === 403, `status=${foreign.status}`)
        check("nonexistent GET returns 403", missing.status === 403, `status=${missing.status}`)
        // This is the single inverted assertion.
        check(
            "foreign and nonexistent bodies are BYTE-IDENTICAL",
            INVERT ? foreign.text !== missing.text : foreign.text === missing.text,
            `foreign=${foreign.text} missing=${missing.text}`,
        )

        const foreignList = await call(service.list(req(`${BASE}?workspaceId=${ids.wsB}`)))
        check(
            "wrong-tenant list is empty",
            pickArray(foreignList.body, "data", "reservations").length === 0,
            `count=${pickArray(foreignList.body, "data", "reservations").length}`,
        )
        check(
            "wrong-tenant list returns 200, so absence is not signalled by an error code",
            foreignList.status === 200,
            `status=${foreignList.status}`,
        )

        // ---- 5. wrong-tenant PATCH refused with no state change -----------
        const statusBefore = (await prisma.reservation.findUnique({ where: { id: createdId } }))?.status
        const foreignPatch = await call(
            service.transition(createdId, jsonReq(`${BASE}/${createdId}`, { workspaceId: ids.wsB, status: "CANCELLED" })),
        )
        const statusAfter = (await prisma.reservation.findUnique({ where: { id: createdId } }))?.status
        check("wrong-tenant PATCH returns 403", foreignPatch.status === 403, `status=${foreignPatch.status}`)
        check("refused PATCH left status unchanged", statusBefore === statusAfter, `${statusBefore} -> ${statusAfter}`)

        // ---- 6. malformed input is 400, not 500 --------------------------
        identity.current = `clerk_${ids.userA}`
        const noWorkspace = await call(service.list(req(BASE)))
        check("missing workspaceId returns 400", noWorkspace.status === 400, `status=${noWorkspace.status}`)

        const badJson = await call(
            service.create(
                new Request(BASE, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" }),
            ),
        )
        check("malformed JSON body returns 400", badJson.status === 400, `status=${badJson.status}`)

        const badStatus = await call(
            service.transition(createdId, jsonReq(`${BASE}/${createdId}`, { workspaceId: ids.wsA, status: "TELEPORTED" })),
        )
        check("unrecognised status returns 400", badStatus.status === 400, `status=${badStatus.status}`)

        const badDate = await call(service.create(jsonReq(BASE, { ...payload, startAt: "not-a-date" })))
        check("invalid timestamp returns 400", badDate.status === 400, `status=${badDate.status}`)

        // ---- 7. lifecycle conflict is 409 -------------------------------
        const illegal = await call(
            service.transition(createdId, jsonReq(`${BASE}/${createdId}`, { workspaceId: ids.wsA, status: "COMPLETED" })),
        )
        check("illegal transition returns 409", illegal.status === 409, `status=${illegal.status} body=${illegal.text.slice(0, 90)}`)

        // ---- 8. legal transition is 200 and history is append-only ------
        const seated = await call(
            service.transition(createdId, jsonReq(`${BASE}/${createdId}`, { workspaceId: ids.wsA, status: "SEATED" })),
        )
        check("legal transition returns 200", seated.status === 200, `status=${seated.status}`)

        const history = await call(service.history(createdId, req(`${BASE}/${createdId}/history?workspaceId=${ids.wsA}`)))
        check("history returns 200", history.status === 200, `status=${history.status}`)
        const kinds = pickArray(history.body, "data", "events")
            .map((e) => pickString(e, "kind"))
            .join(",")
        check("history contains CREATED then STATUS", kinds === "CREATED,STATUS", kinds)

        identity.current = `clerk_${ids.userB}`
        const foreignHistory = await call(
            service.history(createdId, req(`${BASE}/${createdId}/history?workspaceId=${ids.wsB}`)),
        )
        check("wrong-tenant history returns 403", foreignHistory.status === 403, `status=${foreignHistory.status}`)

        // ---- 9. dependency failure is 503 with no internal detail -------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: {
                findUnique: async () => {
                    throw new Error("SECRET_INTERNAL_DETAIL postgres://user:pw@host/db")
                },
            },
        } as unknown as PrismaClient
        const brokenService = new ReservationService(
            new PersistedReservations(brokenPrisma, new PersistedTenancy(prisma, identity)),
        )
        const broken = await call(brokenService.list(req(`${BASE}?workspaceId=${ids.wsA}`)))
        check("dependency failure returns 503", broken.status === 503, `status=${broken.status}`)
        check(
            "dependency failure leaks no internal detail",
            !/SECRET_INTERNAL_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text),
            broken.text.slice(0, 120),
        )
        check(
            "dependency failure uses the DEPENDENCY_UNAVAILABLE code",
            pickString(broken.body, "error", "code") === "DEPENDENCY_UNAVAILABLE",
            broken.text,
        )

        // ---- 10. envelope agrees with PlatformService's contract --------
        const okKeys = Object.keys(asRecord(created.body)).sort().join(",")
        const errKeys = Object.keys(asRecord(anonList.body)).sort().join(",")
        check("success envelope keys are exactly ok,data", okKeys === "data,ok", okKeys)
        check("error envelope keys are exactly error,ok", errKeys === "error,ok", errKeys)
        check(
            "error object carries code and message",
            pickString(anonList.body, "error", "code").length > 0 &&
                pickString(anonList.body, "error", "message").length > 0,
            JSON.stringify(pick(anonList.body, "error")),
        )
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "ReservationEvent" disable trigger "ReservationEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "ReservationEvent" where "reservationId" in (select "id" from "Reservation" where "profileId" in ('${ids.profileA}','${ids.profileB}'))`,
            )
            await prisma.$executeRawUnsafe(`delete from "Reservation" where "profileId" in ('${ids.profileA}','${ids.profileB}')`)
        } finally {
            await prisma.$executeRawUnsafe(`alter table "ReservationEvent" enable trigger "ReservationEvent_append_only"`)
        }
        await prisma.$executeRawUnsafe(`delete from "RestaurantTable" where "profileId" in ('${ids.profileA}','${ids.profileB}')`)
        await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
        await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
        await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`)
        await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)

        const end = await prisma.reservation.count()
        check("reservation rows returned to baseline", end === baseReservations, `baseline=${baseReservations} end=${end}`)

        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All reservation route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
