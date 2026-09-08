-- Documented DOWN migration for 20260828170000_restaurant_reservations
--
-- Prisma does not execute this file automatically. It is applied only through
-- scripts/one-off/p2-guarded-sql.ts, which refuses to run unless BOTH the parsed
-- and the connected database are exactly the authorized disposable rehearsal
-- target, and unless a non-empty external backup is present.
--
-- Every object dropped here was CREATED by the corresponding up migration.
-- No pre-existing table, column, index, constraint, type or function is touched.
--
-- DROP ORDER is topological: ReservationEvent has an FK onto Reservation, so the
-- child goes first. CASCADE is deliberately avoided because it could silently
-- drop constraints on pre-existing tables.
--
-- The "ReservationEvent_append_only" trigger and the "Reservation_no_overlap"
-- exclusion constraint are dropped implicitly with their tables.
--
-- reject_append_only_mutation() is NOT dropped: it was created by
-- 20260827140000_phase0_foundations, not by this migration, and CopilotAuditEvent
-- and ActivityEvent still depend on it.

DROP TABLE IF EXISTS "ReservationEvent";
DROP TABLE IF EXISTS "Reservation";

-- Enums introduced by the up migration
DROP TYPE IF EXISTS "ReservationEventActor";
DROP TYPE IF EXISTS "ReservationEventKind";
DROP TYPE IF EXISTS "ReservationStatus";

-- btree_gist was NOT installed before this migration (verified by probing
-- pg_extension, which returned 0). The up migration installed it, so rollback
-- removes it to return the catalog to its exact pre-apply state. This is safe
-- precisely because nothing else in this database used it; if a future migration
-- starts depending on btree_gist, this line must be removed.
DROP EXTENSION IF EXISTS btree_gist;

-- Remove this migration from Prisma's ledger so a subsequent `migrate deploy`
-- re-applies it cleanly during the reapply rehearsal.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260828170000_restaurant_reservations';
