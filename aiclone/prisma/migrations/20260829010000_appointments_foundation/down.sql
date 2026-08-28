-- Documented DOWN migration for 20260829010000_appointments_foundation
--
-- Prisma does not execute this file automatically. It is applied only through
-- scripts/one-off/p2-guarded-sql.ts, which refuses to run unless BOTH the parsed and
-- the connected database are exactly the authorized disposable rehearsal target, and
-- unless a non-empty external backup is present.
--
-- Every object dropped here was CREATED by the corresponding up migration. No
-- pre-existing table, column, index, constraint, type or function is touched, and the
-- pre-existing Booking rows are left exactly as they were.
--
-- DROP ORDER is topological. AppointmentEvent, AppointmentReminder, AppointmentDeposit
-- and ServiceResource are children; AppointmentWaitlistEntry references both Booking and
-- AppointmentResource; the Booking foreign keys and added columns come next; and
-- AppointmentResource goes last among the new tables. CASCADE is deliberately avoided
-- because it could silently drop constraints on pre-existing tables.

-- 1. The exclusion constraint added to the pre-existing Booking table.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_resource_no_overlap";

-- 2. Foreign keys added to the pre-existing Booking table.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_resourceId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_locationId_fkey";

-- 3. Indexes added to the pre-existing Booking table.
DROP INDEX IF EXISTS "Booking_profileId_idempotencyKey_key";
DROP INDEX IF EXISTS "Booking_profileId_startTime_idx";
DROP INDEX IF EXISTS "Booking_profileId_status_idx";
DROP INDEX IF EXISTS "Booking_resourceId_startTime_idx";

-- 4. New tables. The AppointmentEvent_append_only trigger is dropped implicitly with
--    its table.
DROP TABLE IF EXISTS "AppointmentEvent";
DROP TABLE IF EXISTS "AppointmentReminder";
DROP TABLE IF EXISTS "AppointmentDeposit";
DROP TABLE IF EXISTS "ServiceResource";
DROP TABLE IF EXISTS "AppointmentWaitlistEntry";
DROP TABLE IF EXISTS "AppointmentResource";

-- 5. Columns added to the pre-existing Booking table. Done AFTER the new tables so no
--    foreign key still references them.
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "resourceId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "locationId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "idempotencyKey";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "partySize";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "holdExpiresAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "confirmedAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "checkedInAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "completedAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "cancelledAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "noShowAt";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "cancelReason";

-- 6. Enums introduced by the up migration.
DROP TYPE IF EXISTS "AppointmentEventActor";
DROP TYPE IF EXISTS "AppointmentEventKind";
DROP TYPE IF EXISTS "AppointmentReminderState";
DROP TYPE IF EXISTS "AppointmentReminderChannel";
DROP TYPE IF EXISTS "AppointmentDepositState";
DROP TYPE IF EXISTS "AppointmentWaitlistStatus";
DROP TYPE IF EXISTS "AppointmentResourceKind";

-- btree_gist is deliberately NOT dropped here.
--
-- Wave A's 20260828170000_restaurant_reservations installed it and its
-- Reservation_no_overlap exclusion constraint DEPENDS on it. Wave A's own down.sql drops
-- the extension, which is correct for Wave A in isolation, but dropping it here would
-- break a constraint this migration did not create. Rolling Wave B back must leave
-- Wave A intact.
--
-- reject_append_only_mutation() is likewise NOT dropped: it belongs to
-- 20260827140000_phase0_foundations, and ActivityEvent, CopilotAuditEvent and
-- ReservationEvent still depend on it.

-- Remove this migration from Prisma's ledger so a subsequent `migrate deploy`
-- re-applies it cleanly during the reapply rehearsal.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260829010000_appointments_foundation';
