import path from 'node:path'
import Module from 'node:module'
import { PrismaClient, type Prisma } from '@prisma/client'
import { assertDisposableTarget } from '../lib/disposable-db'
import {
    createOwnershipFoundation,
    ownershipRefusalResponse,
    type SecurityProfile,
    type SecurityUser,
    type ServerIdentitySource,
} from '../../src/lib/security/ownership'

const EXPECTED_DATABASE = 'personalink_phase0_rehearsal_20260826_210704'
const checkedDatabase = assertDisposableTarget(process.env.DATABASE_URL)
if (checkedDatabase !== EXPECTED_DATABASE) {
    throw new Error('Refusing route authorization check: unexpected disposable database target')
}

const projectRoot = path.resolve(__dirname, '../..')
const moduleInternals = Module as unknown as {
    _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string
}
const originalResolveFilename = moduleInternals._resolveFilename
moduleInternals._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
    const resolvedRequest = request.startsWith('@/')
        ? path.join(projectRoot, 'src', request.slice(2))
        : request
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options)
}

type RouteModules = Readonly<{
    course: typeof import('../../src/app/api/courses/complete-lesson/route')
    booking: typeof import('../../src/app/api/calendar/event/[bookingId]/route')
    stripe: typeof import('../../src/app/api/stripe/products/route')
}>

const prisma = new PrismaClient()
const failures: string[] = []
const assertions: string[] = []
const invert = process.env.INVERT_ASSERTION === '1'

function check(name: string, condition: unknown, inversionTarget = false): void {
    assertions.push(name)
    const passed = inversionTarget && invert ? !condition : Boolean(condition)
    if (!passed) failures.push(name)
}

class Rollback extends Error {}

class MutableIdentity implements ServerIdentitySource<SecurityProfile> {
    current: SecurityUser<SecurityProfile> | null = null

    async resolve(): Promise<SecurityUser<SecurityProfile> | null> {
        return this.current
    }
}

async function json(response: Response): Promise<Record<string, unknown>> {
    return await response.json() as Record<string, unknown>
}

async function snapshot(response: Response): Promise<{ status: number; body: string }> {
    return { status: response.status, body: await response.text() }
}

function request(url: string, init?: RequestInit): Request {
    return new Request(url, init)
}

async function seed(db: Prisma.TransactionClient) {
    const now = new Date('2026-08-28T00:00:00.000Z')
    const later = new Date('2026-08-29T00:00:00.000Z')

    await db.user.createMany({ data: [
        { id: 'lane-c-user-a', clerkId: 'lane-c-clerk-a', email: 'lane-c-a@example.invalid', name: 'Lane C A' },
        { id: 'lane-c-user-b', clerkId: 'lane-c-clerk-b', email: 'lane-c-b@example.invalid', name: 'Lane C B' },
        { id: 'lane-c-user-c', clerkId: 'lane-c-clerk-c', email: 'lane-c-c@example.invalid', name: 'Lane C C' },
    ] })
    await db.profile.createMany({ data: [
        { id: 'lane-c-profile-public', userId: 'lane-c-user-a', slug: 'lane-c-public', displayName: 'Public Lane C', isPublic: true },
        { id: 'lane-c-profile-private', userId: 'lane-c-user-b', slug: 'lane-c-private', displayName: 'Private Lane C', isPublic: false },
        { id: 'lane-c-profile-foreign', userId: 'lane-c-user-b', slug: 'lane-c-foreign', displayName: 'Foreign Lane C', isPublic: true },
    ] })
    await db.member.createMany({ data: [
        { id: 'lane-c-member-a', clerkId: 'lane-c-clerk-a', email: 'lane-c-a@example.invalid', name: 'Member A' },
        { id: 'lane-c-member-b', clerkId: 'lane-c-clerk-b', email: 'lane-c-b@example.invalid', name: 'Member B' },
        { id: 'lane-c-member-c', clerkId: 'lane-c-clerk-c', email: 'lane-c-c@example.invalid', name: 'Member C' },
    ] })
    await db.course.createMany({ data: [
        { id: 'lane-c-course-a', profileId: 'lane-c-profile-public', title: 'Published course', isActive: true, isPublished: true, totalModules: 1, totalLessons: 1 },
        { id: 'lane-c-course-b', profileId: 'lane-c-profile-foreign', title: 'Other course', isActive: true, isPublished: true, totalModules: 1, totalLessons: 1 },
        { id: 'lane-c-course-hidden', profileId: 'lane-c-profile-public', title: 'LANE_C_UNPUBLISHED_COURSE', isActive: true, isPublished: false },
    ] })
    await db.courseModule.createMany({ data: [
        { id: 'lane-c-module-a', courseId: 'lane-c-course-a', title: 'Module A', orderIndex: 0 },
        { id: 'lane-c-module-b', courseId: 'lane-c-course-b', title: 'Module B', orderIndex: 0 },
        { id: 'lane-c-module-hidden', courseId: 'lane-c-course-hidden', title: 'Hidden module', orderIndex: 0 },
    ] })
    await db.courseLesson.createMany({ data: [
        { id: 'lane-c-lesson-a', moduleId: 'lane-c-module-a', title: 'Lesson A', body: 'LANE_C_PRIVATE_LESSON_BODY', fileUrl: 'https://private.invalid/file', orderIndex: 0 },
        { id: 'lane-c-lesson-b', moduleId: 'lane-c-module-b', title: 'Lesson B', orderIndex: 0 },
        { id: 'lane-c-lesson-hidden', moduleId: 'lane-c-module-hidden', title: 'LANE_C_UNPUBLISHED_LESSON', orderIndex: 0 },
    ] })
    await db.courseEnrollment.createMany({ data: [
        { id: 'lane-c-enrollment-a', courseId: 'lane-c-course-a', memberId: 'lane-c-member-a', visitorEmail: 'lane-c-a@example.invalid', status: 'ACTIVE' },
        { id: 'lane-c-enrollment-b', courseId: 'lane-c-course-b', memberId: 'lane-c-member-b', visitorEmail: 'lane-c-b@example.invalid', status: 'ACTIVE' },
    ] })
    await db.serviceOffering.createMany({ data: [
        { id: 'lane-c-service-a', profileId: 'lane-c-profile-public', name: 'Owner service' },
        { id: 'lane-c-service-b', profileId: 'lane-c-profile-foreign', name: 'Foreign service' },
    ] })
    await db.booking.createMany({ data: [
        { id: 'lane-c-booking-a', profileId: 'lane-c-profile-public', visitorName: 'Visitor A', visitorEmail: 'visitor-a@example.invalid', serviceOfferingId: 'lane-c-service-a', startTime: now, endTime: later, status: 'CONFIRMED' },
        { id: 'lane-c-booking-b', profileId: 'lane-c-profile-foreign', visitorName: 'Visitor B', visitorEmail: 'visitor-b@example.invalid', serviceOfferingId: 'lane-c-service-b', startTime: now, endTime: later, status: 'CONFIRMED' },
    ] })
    await db.digitalProduct.createMany({ data: [
        { id: 'lane-c-product-visible', profileId: 'lane-c-profile-public', title: 'Visible product', fileUrl: 'https://private.invalid/download', priceCents: 100, isActive: true },
        { id: 'lane-c-product-hidden', profileId: 'lane-c-profile-public', title: 'LANE_C_INACTIVE_PRODUCT', priceCents: 200, isActive: false },
    ] })
    await db.event.createMany({ data: [
        { id: 'lane-c-event-visible', profileId: 'lane-c-profile-public', title: 'Visible event', startTime: now, endTime: later, meetingUrl: 'https://private.invalid/meeting', isActive: true },
        { id: 'lane-c-event-hidden', profileId: 'lane-c-profile-public', title: 'LANE_C_INACTIVE_EVENT', startTime: now, endTime: later, isActive: false },
    ] })
    await db.community.createMany({ data: [
        { id: 'lane-c-community-visible', profileId: 'lane-c-profile-public', name: 'Visible community', inviteLink: 'https://private.invalid/invite', isActive: true },
        { id: 'lane-c-community-hidden', profileId: 'lane-c-profile-public', name: 'LANE_C_INACTIVE_COMMUNITY', isActive: false },
    ] })
}

async function runChecks(db: Prisma.TransactionClient, routes: RouteModules): Promise<void> {
    const { createCompleteLessonPost } = routes.course
    const { createBookingEventGet } = routes.booking
    const { createPublicCatalogGet, createStripeProductPost } = routes.stripe
    await seed(db)
    const identity = new MutableIdentity()
    const foundation = createOwnershipFoundation(identity)

    const completeLesson = createCompleteLessonPost({
        requireAuthenticatedUser: foundation.requireAuthenticatedUser as never,
        ownershipRefusalResponse,
        withTransaction: (work) => work(db),
    })
    const completionRequest = (enrollmentId: string, lessonId: string) => request(
        'http://route.test/api/courses/complete-lesson',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enrollmentId, lessonId }) },
    )
    const completionCount = () => db.lessonCompletion.count()

    const beforeAnonymousCompletion = await completionCount()
    const anonymousCompletion = await completeLesson(completionRequest('lane-c-enrollment-a', 'lane-c-lesson-a') as never)
    check('lesson: anonymous request is refused', anonymousCompletion.status === 401, true)
    check('lesson: anonymous refusal creates no completion', await completionCount() === beforeAnonymousCompletion)

    identity.current = { id: 'lane-c-user-b', profiles: [{ id: 'lane-c-profile-foreign' }] }
    const beforeWrongMember = await completionCount()
    const wrongMember = await completeLesson(completionRequest('lane-c-enrollment-a', 'lane-c-lesson-a') as never)
    check('lesson: authenticated wrong member is refused', wrongMember.status === 403)
    check('lesson: wrong-member refusal creates no completion', await completionCount() === beforeWrongMember)

    identity.current = { id: 'lane-c-user-c', profiles: [] }
    const notEnrolled = await completeLesson(completionRequest('lane-c-enrollment-a', 'lane-c-lesson-a') as never)
    check('lesson: authenticated member without enrollment is refused', notEnrolled.status === 403)
    check('lesson: not-enrolled refusal creates no completion', await completionCount() === beforeWrongMember)

    identity.current = { id: 'lane-c-user-a', profiles: [{ id: 'lane-c-profile-public' }] }
    const wrongCourseLesson = await completeLesson(completionRequest('lane-c-enrollment-a', 'lane-c-lesson-b') as never)
    check('lesson: lesson from another course is refused', wrongCourseLesson.status === 403)
    check('lesson: wrong-course refusal creates no completion', await completionCount() === beforeWrongMember)

    const foreignEnrollment = await snapshot(await completeLesson(completionRequest('lane-c-enrollment-b', 'lane-c-lesson-b') as never))
    const missingEnrollment = await snapshot(await completeLesson(completionRequest('lane-c-enrollment-missing', 'lane-c-lesson-b') as never))
    check('lesson: foreign and missing enrollment refusals are identical', JSON.stringify(foreignEnrollment) === JSON.stringify(missingEnrollment))
    check('lesson: enumeration probes create no completion', await completionCount() === beforeWrongMember)

    const ownCompletion = await completeLesson(completionRequest('lane-c-enrollment-a', 'lane-c-lesson-a') as never)
    check('lesson: valid member completion succeeds', ownCompletion.status === 200)
    check('lesson: valid member creates exactly one scoped completion', await db.lessonCompletion.count({ where: { enrollmentId: 'lane-c-enrollment-a', lessonId: 'lane-c-lesson-a' } }) === 1)
    check('lesson: foreign enrollment remains unchanged', await db.lessonCompletion.count({ where: { enrollmentId: 'lane-c-enrollment-b' } }) === 0)

    const bookingGet = createBookingEventGet({
        db,
        requireOwnedResource: foundation.requireOwnedResource as never,
        ownershipRefusalResponse,
        buildIcs: (input) => `ICS:${input.events[0]?.id ?? ''}`,
        icsResponse: (content) => new Response(content, { status: 200, headers: { 'content-type': 'text/calendar' } }),
    })
    const bookingRequest = (id: string, profileId?: string) => request(`http://route.test/api/calendar/event/${id}${profileId ? `?profileId=${profileId}` : ''}`)
    const bookingStateBefore = JSON.stringify(await db.booking.findMany({ orderBy: { id: 'asc' } }))

    identity.current = null
    const anonymousBooking = await bookingGet(bookingRequest('lane-c-booking-a') as never, { params: Promise.resolve({ bookingId: 'lane-c-booking-a' }) })
    check('booking: anonymous request is refused', anonymousBooking.status === 401)

    identity.current = { id: 'lane-c-user-b', profiles: [{ id: 'lane-c-profile-foreign' }] }
    const foreignBooking = await snapshot(await bookingGet(bookingRequest('lane-c-booking-a') as never, { params: Promise.resolve({ bookingId: 'lane-c-booking-a' }) }))
    const missingBooking = await snapshot(await bookingGet(bookingRequest('lane-c-booking-missing') as never, { params: Promise.resolve({ bookingId: 'lane-c-booking-missing' }) }))
    check('booking: wrong owner is refused', foreignBooking.status === 403)
    check('booking: foreign and missing booking refusals are identical', JSON.stringify(foreignBooking) === JSON.stringify(missingBooking))

    identity.current = { id: 'lane-c-user-a', profiles: [{ id: 'lane-c-profile-public' }] }
    const ownBooking = await bookingGet(bookingRequest('lane-c-booking-a') as never, { params: Promise.resolve({ bookingId: 'lane-c-booking-a' }) })
    check('booking: valid profile owner succeeds', ownBooking.status === 200 && (await ownBooking.text()).includes('lane-c-booking-a'))
    check('booking: every read/refusal leaves bookings unchanged', JSON.stringify(await db.booking.findMany({ orderBy: { id: 'asc' } })) === bookingStateBefore)

    const catalogGet = createPublicCatalogGet({ db })
    const catalogCountsBefore = await Promise.all([
        db.digitalProduct.count(), db.course.count(), db.event.count(), db.community.count(),
    ])
    const publicCatalogResponse = await catalogGet(request('http://route.test/api/stripe/products?profileId=lane-c-profile-public') as never)
    const publicCatalog = await json(publicCatalogResponse)
    const publicCatalogText = JSON.stringify(publicCatalog)
    check('catalog: anonymous access to a public profile succeeds', publicCatalogResponse.status === 200)
    check('catalog: inactive and unpublished nested records are absent', !publicCatalogText.includes('LANE_C_INACTIVE_') && !publicCatalogText.includes('LANE_C_UNPUBLISHED_'))
    check('catalog: private fulfillment and meeting fields are absent', !publicCatalogText.includes('private.invalid') && !publicCatalogText.includes('fileUrl') && !publicCatalogText.includes('meetingUrl') && !publicCatalogText.includes('inviteLink'))
    const privateCatalog = await snapshot(await catalogGet(request('http://route.test/api/stripe/products?profileId=lane-c-profile-private') as never))
    const missingCatalog = await snapshot(await catalogGet(request('http://route.test/api/stripe/products?profileId=lane-c-profile-missing') as never))
    check('catalog: private profile is refused', privateCatalog.status === 404)
    check('catalog: private and missing profiles are non-enumerating', JSON.stringify(privateCatalog) === JSON.stringify(missingCatalog))
    check('catalog: reads and refusals leave catalog state unchanged', JSON.stringify(await Promise.all([db.digitalProduct.count(), db.course.count(), db.event.count(), db.community.count()])) === JSON.stringify(catalogCountsBefore))

    let stripeProductCalls = 0
    let stripePriceCalls = 0
    const stripePost = createStripeProductPost({
        requireOwnedProfile: foundation.requireOwnedProfile as never,
        ownershipRefusalResponse,
        getStripeClient: async () => ({
            products: { create: async () => { stripeProductCalls += 1; return { id: 'stub-product' } } },
            prices: { create: async () => { stripePriceCalls += 1; return { id: 'stub-price' } } },
        }),
    })
    const stripeRequest = (profileId: string) => request('http://route.test/api/stripe/products', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId, name: 'Test', priceCents: 100, productType: 'DIGITAL' }),
    })

    identity.current = null
    const anonymousStripe = await stripePost(stripeRequest('lane-c-profile-public') as never)
    check('stripe write: anonymous request is refused', anonymousStripe.status === 401)
    check('stripe write: anonymous refusal never calls Stripe', stripeProductCalls === 0 && stripePriceCalls === 0)

    identity.current = { id: 'lane-c-user-b', profiles: [{ id: 'lane-c-profile-foreign' }] }
    const wrongTenantStripe = await snapshot(await stripePost(stripeRequest('lane-c-profile-public') as never))
    const missingProfileStripe = await snapshot(await stripePost(stripeRequest('lane-c-profile-missing') as never))
    check('stripe write: wrong profile owner is refused', wrongTenantStripe.status === 403)
    check('stripe write: foreign and missing profile refusals are identical', JSON.stringify(wrongTenantStripe) === JSON.stringify(missingProfileStripe))
    check('stripe write: every refusal avoids Stripe', stripeProductCalls === 0 && stripePriceCalls === 0)

    identity.current = { id: 'lane-c-user-a', profiles: [{ id: 'lane-c-profile-public' }] }
    const ownStripe = await stripePost(stripeRequest('lane-c-profile-public') as never)
    check('stripe write: valid profile owner succeeds with stub', ownStripe.status === 200)
    check('stripe write: success calls only the stub once per operation', stripeProductCalls === 1 && stripePriceCalls === 1)
}

async function main(): Promise<void> {
    const [course, booking, stripe] = await Promise.all([
        import('../../src/app/api/courses/complete-lesson/route'),
        import('../../src/app/api/calendar/event/[bookingId]/route'),
        import('../../src/app/api/stripe/products/route'),
    ])
    const routes: RouteModules = { course, booking, stripe }

    try {
        await prisma.$transaction(async (db) => {
            await runChecks(db, routes)
            throw new Rollback('deterministic rollback')
        })
    } catch (error) {
        if (!(error instanceof Rollback)) throw error
    }

    const rolledBackRows = await prisma.user.count({ where: { id: { startsWith: 'lane-c-user-' } } })
    check('database fixture transaction rolled back deterministically', rolledBackRows === 0)

    console.log(JSON.stringify({
        result: failures.length === 0 ? 'PASS' : 'FAIL',
        assertions: assertions.length,
        coverage: [
            'anonymous refusal and valid-owner success',
            'wrong member, wrong tenant, wrong entitlement, and wrong-course refusal',
            'foreign and nonexistent identifiers are response-identical',
            'no database effect on refusal',
            'public-profile gate and explicit public projection',
            'private and unpublished nested catalog content excluded',
            'Stripe fully stubbed and never called on refusal',
            'transaction-scoped fixtures with deterministic rollback',
        ],
        failures,
    }, null, 2))

    if (failures.length > 0) process.exitCode = 1
}

void main().finally(() => prisma.$disconnect())
