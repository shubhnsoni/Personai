# Lane C resource and enrollment authorization

## Protected lesson completion

`POST /api/courses/complete-lesson` calls `requireAuthenticatedUser()` before reading request-owned resources. Inside one Prisma transaction it resolves the server-authenticated database user to the corresponding `Member`, then performs one enrollment lookup constrained by all of:

- requested enrollment id;
- authenticated member id;
- enrollment status `ACTIVE` or `COMPLETED`;
- the enrollment's course containing the requested lesson through `Course.modules.lessons`.

Only that validated enrollment and lesson pair is used for the completion upsert. Completion counting is constrained to lessons in the same course, and the enrollment completion update remains constrained by enrollment id, course id, and member id. Missing, foreign-member, not-enrolled, and wrong-course lesson requests all return the shared non-enumerating `FORBIDDEN` response and write nothing.

## Protected booking calendar

`GET /api/calendar/event/[bookingId]` uses authenticated profile ownership, not a bearer capability. It calls `requireOwnedResource()` and performs a single lookup constrained by both booking id and the server-owned profile id. A caller may select one of their own profiles with `?profileId=...`; the security foundation validates that claim before the booking lookup. Cancelled, foreign, and nonexistent bookings all produce the same `FORBIDDEN` response. The route has no mutation path.

This endpoint is **not public by design**. Booking ids are not treated as credentials, and no calendar data is returned to an anonymous requester.

## Intentionally public catalog

`GET /api/stripe/products?profileId=...` is the only intentionally public operation in this lane. Anonymous access succeeds only when the requested profile has `isPublic: true`. A private profile and a nonexistent profile both return the same `404 {"error":"Catalog not found"}` response.

The route performs one profile-gated query with an explicit projection. It returns only catalog presentation fields:

- products: identity, title/description/type, thumbnail/subtitle, comparison and sale price, currency, and category;
- published active courses: presentation and pricing fields, module labels/order, and lesson labels/order/duration/free-preview marker;
- active events: presentation, schedule, location, price, and capacity fields;
- active communities: presentation, platform, price, billing cycle, and member count.

It deliberately excludes whole ORM objects and private fulfillment/content fields such as product `fileUrl`/`body`, lesson `contentUrl`/`videoUrl`/`body`/`fileUrl`, event `meetingUrl`, community `inviteLink`, inactive records, and unpublished courses with all nested modules and lessons.

`POST /api/stripe/products` is not public. It calls `requireOwnedProfile()` before obtaining a Stripe client. Foreign and nonexistent profile claims are response-identical, and Stripe is not called on any authorization refusal.

## Executable evidence

`scripts/one-off/check-resource-authz.ts` invokes the actual route-handler factories against the approved disposable rehearsal database. Fixtures and successful writes run inside one interactive transaction that ends with a deterministic rollback. The script calls `assertDisposableTarget()` before constructing the Prisma client and also requires the exact rehearsal database name.

The check covers anonymous refusal, wrong member/profile, no enrollment, wrong-course lesson, private profile, valid owner/member success, response-identical foreign and missing ids, unchanged state after refusals, explicit absence of private/unpublished catalog markers, and a fully stubbed Stripe client that is never reached on refusal. `INVERT_ASSERTION=1` reverses a central anonymous-lesson assertion to prove the harness exits non-zero.
