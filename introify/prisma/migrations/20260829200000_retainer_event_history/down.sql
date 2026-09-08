-- Rollback for 20260829200000_retainer_event_history.
--
-- One table and its trigger. reject_append_only_mutation() is deliberately NOT dropped: eight
-- other ledgers depend on it. No pre-existing object is touched, and no enum is modified, so
-- unlike the first G3 migration this rollback needs no type recreation.

DROP TRIGGER IF EXISTS "CaseRetainerEvent_append_only" ON "CaseRetainerEvent";
DROP TABLE IF EXISTS "CaseRetainerEvent";
