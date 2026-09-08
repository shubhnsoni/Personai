/**
 * Wave A / A1 reservation schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write is
 * performed inside a transaction that is deliberately rolled back, so the harness
 * leaves the database byte-identical to how it found it.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node scripts/one-off/check-reservation-schema-invariants.ts
 *
 * NOTE ON MODULE SYSTEM: scripts/tsconfig.checks.json compiles this as CommonJS,
 * where `import.meta` is a COMPILE ERROR. A harness that cannot compile exits 1 in
 * normal, inverted and restored runs alike, which looks exactly like an assertion
 * failure and is not evidence of anything. Use `__filename` if a require is needed.
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}

function errLine(e: unknown): string {
  const lines = String((e as Error).message)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    lines.find(
      (l) =>
        l.includes("append-only") ||
        l.includes("ERROR") ||
        l.includes("conflicting") ||
        l.includes("duplicate"),
    ) ??
    lines[0] ??
    "unknown error"
  ).slice(0, 120);
}

class Rollback extends Error {}

/** Unique-per-run suffix so concurrent or repeated runs cannot collide. */
const RUN = `wa_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Creates the minimum real rows a reservation needs: User -> Profile -> RestaurantTable. */
async function seed(tx: Tx, seats: number | null): Promise<{ profileId: string; tableId: string }> {
  const userId = `${RUN}_u`;
  const profileId = `${RUN}_p`;
  const tableId = `${RUN}_t`;
  await tx.$executeRawUnsafe(
    `insert into "User" ("id","clerkId","email","updatedAt") values ('${userId}','${RUN}_clerk','${RUN}@example.test',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${profileId}','${userId}','${RUN}-slug','WaveA Venue',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "RestaurantTable" ("id","profileId","label","code","seats","updatedAt") values ('${tableId}','${profileId}','T1','${RUN}_code',${seats === null ? "NULL" : seats},CURRENT_TIMESTAMP)`,
  );
  return { profileId, tableId };
}

function insertReservation(
  tx: Tx,
  o: {
    id: string;
    profileId: string;
    tableId: string;
    start: string;
    end: string;
    status?: string;
    idem?: string | null;
    party?: number;
  },
): Promise<number> {
  const status = o.status ?? "CONFIRMED";
  const idem = o.idem === undefined ? null : o.idem;
  return tx.$executeRawUnsafe(
    `insert into "Reservation"
       ("id","profileId","tableId","idempotencyKey","partySize","startAt","endAt","status","guestName","updatedAt")
     values
       ('${o.id}','${o.profileId}','${o.tableId}',${idem === null ? "NULL" : `'${idem}'`},${o.party ?? 2},
        '${o.start}'::timestamp,'${o.end}'::timestamp,'${status}'::"ReservationStatus",'Guest',CURRENT_TIMESTAMP)`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  const db = parseDatabaseName(url);
  assertDisposableTarget(url);
  if (db !== AUTHORIZED_TARGET) {
    console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db");
    if (live[0].db !== AUTHORIZED_TARGET) {
      console.error(`ABORT: connected to ${live[0].db}`);
      process.exit(1);
    }

    // ---- 1. both new tables exist ------------------------------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    for (const t of ["Reservation", "ReservationEvent"]) {
      check(`table ${t} present`, tables.includes(t), tables.includes(t) ? "present" : "MISSING");
    }

    // ---- 2. all three enums exist with the expected labels ------------------
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
      "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname in ('ReservationStatus','ReservationEventKind','ReservationEventActor')",
    );
    const labelsOf = (n: string) => enums.filter((e) => e.typname === n).map((e) => e.enumlabel).sort();
    check(
      "ReservationStatus has 7 labels",
      labelsOf("ReservationStatus").length === 7,
      labelsOf("ReservationStatus").join(","),
    );
    check(
      "ReservationEventKind has 3 labels",
      labelsOf("ReservationEventKind").length === 3,
      labelsOf("ReservationEventKind").join(","),
    );
    check(
      "ReservationEventActor has 3 labels",
      labelsOf("ReservationEventActor").length === 3,
      labelsOf("ReservationEventActor").join(","),
    );

    // ---- 3. foreign keys point at the real restaurant tables ---------------
    const fks = await prisma.$queryRawUnsafe<{ constraint_name: string; def: string }[]>(
      `select conname as constraint_name, pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype='f' and conrelid in ('"Reservation"'::regclass, '"ReservationEvent"'::regclass)`,
    );
    const tableFk = fks.find((f) => f.constraint_name === "Reservation_tableId_fkey");
    check(
      "Reservation.tableId references RestaurantTable",
      !!tableFk && /REFERENCES\s+"RestaurantTable"/i.test(tableFk.def),
      tableFk ? tableFk.def.slice(0, 80) : "MISSING",
    );
    check(
      "Reservation.tableId uses ON DELETE RESTRICT",
      !!tableFk && /ON DELETE RESTRICT/i.test(tableFk.def),
      tableFk ? tableFk.def.slice(0, 90) : "MISSING",
    );
    const profileFk = fks.find((f) => f.constraint_name === "Reservation_profileId_fkey");
    check(
      "Reservation.profileId references Profile",
      !!profileFk && /REFERENCES\s+"Profile"/i.test(profileFk.def),
      profileFk ? profileFk.def.slice(0, 80) : "MISSING",
    );

    // ---- 4. the overlap exclusion constraint exists and is partial ---------
    const excl = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      "select conname, pg_get_constraintdef(oid) as def from pg_constraint where contype='x'",
    );
    const noOverlap = excl.find((e) => e.conname === "Reservation_no_overlap");
    check("exclusion constraint Reservation_no_overlap present", !!noOverlap, noOverlap ? "present" : "MISSING");
    check(
      "exclusion constraint is restricted to non-terminal statuses",
      !!noOverlap && /WHERE/i.test(noOverlap.def) && /REQUESTED/.test(noOverlap.def),
      noOverlap ? noOverlap.def.slice(0, 120) : "MISSING",
    );

    // ---- 5. append-only triggers registered for UPDATE and DELETE ----------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["ReservationEvent.UPDATE", "ReservationEvent.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }

    // ---- 6. append-only ENFORCEMENT actually refuses UPDATE and DELETE -----
    for (const op of ["UPDATE", "DELETE"] as const) {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 4);
          const rid = `${RUN}_r_${op}`;
          await insertReservation(tx, {
            id: rid,
            profileId,
            tableId,
            start: "2030-01-01 18:00:00",
            end: "2030-01-01 20:00:00",
          });
          const eid = `${RUN}_e_${op}`;
          await tx.$executeRawUnsafe(
            `insert into "ReservationEvent" ("id","reservationId","kind","to","actor") values ('${eid}','${rid}','CREATED','REQUESTED','STAFF')`,
          );
          try {
            if (op === "UPDATE") {
              await tx.$executeRawUnsafe(`update "ReservationEvent" set "to"='mutated' where "id"='${eid}'`);
            } else {
              await tx.$executeRawUnsafe(`delete from "ReservationEvent" where "id"='${eid}'`);
            }
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) {
          refused = true;
          detail = errLine(e);
        }
      }
      check(`ReservationEvent refuses ${op}`, refused && detail.length > 0, detail || "NO ERROR OBSERVED");
    }

    // ---- 7. overlapping reservation on the same table is REFUSED -----------
    // This is the database-level defense-in-depth layer. The application row-lock
    // path is proven separately by the A2 engine harness.
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          await insertReservation(tx, {
            id: `${RUN}_ov_a`,
            profileId,
            tableId,
            start: "2030-02-01 18:00:00",
            end: "2030-02-01 20:00:00",
          });
          try {
            await insertReservation(tx, {
              id: `${RUN}_ov_b`,
              profileId,
              tableId,
              start: "2030-02-01 19:00:00", // overlaps the first
              end: "2030-02-01 21:00:00",
            });
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) {
          refused = true;
          detail = errLine(e);
        }
      }
      // The single inverted assertion lives here.
      check(
        "overlapping reservation on same table is refused",
        INVERT ? !refused : refused && detail.length > 0,
        detail || "NO ERROR OBSERVED",
      );
    }

    // ---- 8. adjacent booking is ALLOWED (half-open range semantics) --------
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          await insertReservation(tx, {
            id: `${RUN}_adj_a`,
            profileId,
            tableId,
            start: "2030-03-01 18:00:00",
            end: "2030-03-01 20:00:00",
          });
          await insertReservation(tx, {
            id: `${RUN}_adj_b`,
            profileId,
            tableId,
            start: "2030-03-01 20:00:00", // starts exactly when the first ends
            end: "2030-03-01 22:00:00",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("adjacent booking at exact turnover boundary is allowed", accepted, detail || "accepted");
    }

    // ---- 9. terminal-status booking does NOT block the slot ---------------
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          await insertReservation(tx, {
            id: `${RUN}_term_a`,
            profileId,
            tableId,
            start: "2030-04-01 18:00:00",
            end: "2030-04-01 20:00:00",
            status: "CANCELLED",
          });
          await insertReservation(tx, {
            id: `${RUN}_term_b`,
            profileId,
            tableId,
            start: "2030-04-01 18:30:00", // overlaps, but the other is CANCELLED
            end: "2030-04-01 19:30:00",
            status: "CONFIRMED",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("cancelled booking does not block an overlapping slot", accepted, detail || "accepted");
    }

    // ---- 10. same slot on a DIFFERENT table is allowed --------------------
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          const t2 = `${RUN}_t2`;
          await tx.$executeRawUnsafe(
            `insert into "RestaurantTable" ("id","profileId","label","code","seats","updatedAt") values ('${t2}','${profileId}','T2','${RUN}_code2',4,CURRENT_TIMESTAMP)`,
          );
          await insertReservation(tx, {
            id: `${RUN}_dt_a`,
            profileId,
            tableId,
            start: "2030-05-01 18:00:00",
            end: "2030-05-01 20:00:00",
          });
          await insertReservation(tx, {
            id: `${RUN}_dt_b`,
            profileId,
            tableId: t2,
            start: "2030-05-01 18:00:00", // identical slot, different table
            end: "2030-05-01 20:00:00",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("identical slot on a different table is allowed", accepted, detail || "accepted");
    }

    // ---- 11. idempotency key is unique per profile ------------------------
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          await insertReservation(tx, {
            id: `${RUN}_idem_a`,
            profileId,
            tableId,
            start: "2030-06-01 18:00:00",
            end: "2030-06-01 20:00:00",
            idem: "same-key",
          });
          try {
            await insertReservation(tx, {
              id: `${RUN}_idem_b`,
              profileId,
              tableId,
              start: "2030-06-02 18:00:00", // no overlap; only the key repeats
              end: "2030-06-02 20:00:00",
              idem: "same-key",
            });
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) {
          refused = true;
          detail = errLine(e);
        }
      }
      check("duplicate idempotencyKey within a profile is refused", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 12. seq is monotonic within a reservation ------------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, tableId } = await seed(tx, 6);
          const rid = `${RUN}_seq_r`;
          await insertReservation(tx, {
            id: rid,
            profileId,
            tableId,
            start: "2030-07-01 18:00:00",
            end: "2030-07-01 20:00:00",
          });
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "ReservationEvent" ("id","reservationId","kind","to","actor") values ('${RUN}_seq_e${i}','${rid}','STATUS','CONFIRMED','SYSTEM')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "ReservationEvent" where "reservationId"='${rid}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("ReservationEvent.seq is monotonic per reservation", ordered, detail);
    }

    // ---- 13. zero residue and pre-existing rows untouched ----------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "Reservation" where "id" like '${RUN}%')
            + (select count(*) from "ReservationEvent" where "id" like '${RUN}%')
            + (select count(*) from "RestaurantTable" where "id" like '${RUN}%')
            + (select count(*) from "Profile" where "id" like '${RUN}%')
            + (select count(*) from "User" where "id" like '${RUN}%') as n`,
    );
    check("harness left zero residue", Number(residue[0].n) === 0, `residue rows=${residue[0].n}`);
  } finally {
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} invariants passed`);
  if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof");
  if (failed.length) process.exit(1);
  console.log("All reservation schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
