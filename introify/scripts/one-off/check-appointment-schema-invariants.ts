/**
 * Wave B / B1 appointment schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens
 * inside a transaction that is deliberately rolled back, so the harness leaves the
 * database byte-identical to how it found it.
 *
 * The most important assertions here are the ones that protect PRE-EXISTING data:
 * Booking gained columns and an exclusion constraint, and a booking with no resource
 * must never conflict with another. If that were wrong, the migration would have broken
 * the shipped booking flow.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-appointment-schema-invariants.ts
 *
 * MODULE NOTE: compiled as CommonJS by scripts/tsconfig.checks.json, where
 * `import.meta` is a compile error. A harness that cannot compile is not evidence.
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";
const RUN = `wb1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const NEW_TABLES = [
  "AppointmentResource",
  "ServiceResource",
  "AppointmentWaitlistEntry",
  "AppointmentDeposit",
  "AppointmentReminder",
  "AppointmentEvent",
] as const;

const NEW_ENUMS: Array<[string, number]> = [
  ["AppointmentResourceKind", 3],
  ["AppointmentWaitlistStatus", 5],
  ["AppointmentDepositState", 7],
  ["AppointmentReminderChannel", 3],
  ["AppointmentReminderState", 5],
  ["AppointmentEventKind", 5],
  ["AppointmentEventActor", 3],
];

/** Columns Wave B added to the pre-existing Booking table, and their expected nullability. */
const BOOKING_ADDED: Array<[string, "YES" | "NO"]> = [
  ["resourceId", "YES"],
  ["locationId", "YES"],
  ["idempotencyKey", "YES"],
  ["partySize", "NO"],
  ["holdExpiresAt", "YES"],
  ["confirmedAt", "YES"],
  ["checkedInAt", "YES"],
  ["completedAt", "YES"],
  ["cancelledAt", "YES"],
  ["noShowAt", "YES"],
  ["cancelReason", "YES"],
];

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}

function errLine(e: unknown): string {
  const lines = String((e as Error).message).split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    lines.find(
      (l) =>
        l.includes("append-only") ||
        l.includes("ERROR") ||
        l.includes("conflicting") ||
        l.includes("duplicate") ||
        l.includes("violates"),
    ) ?? lines[0] ?? "unknown error"
  ).slice(0, 130);
}

class Rollback extends Error {}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function seed(tx: Tx): Promise<{ profileId: string; serviceId: string; resourceId: string }> {
  const userId = `${RUN}_u`;
  const profileId = `${RUN}_p`;
  const serviceId = `${RUN}_s`;
  const resourceId = `${RUN}_r`;
  await tx.$executeRawUnsafe(
    `insert into "User" ("id","clerkId","email","updatedAt") values ('${userId}','${RUN}_clerk','${RUN}@example.test',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${profileId}','${userId}','${RUN}-slug','WaveB Practice',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "ServiceOffering" ("id","profileId","name","updatedAt") values ('${serviceId}','${profileId}','Consultation',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "AppointmentResource" ("id","profileId","name","kind","capacity","updatedAt") values ('${resourceId}','${profileId}','Alice','STAFF',1,CURRENT_TIMESTAMP)`,
  );
  return { profileId, serviceId, resourceId };
}

function insertBooking(
  tx: Tx,
  o: {
    id: string;
    profileId: string;
    serviceId: string;
    resourceId: string | null;
    start: string;
    end: string;
    status?: string;
    idem?: string | null;
  },
): Promise<number> {
  const status = o.status ?? "CONFIRMED";
  return tx.$executeRawUnsafe(
    `insert into "Booking"
       ("id","profileId","visitorName","visitorEmail","serviceOfferingId","resourceId","idempotencyKey","startTime","endTime","status","updatedAt")
     values
       ('${o.id}','${o.profileId}','Guest','g@example.test','${o.serviceId}',
        ${o.resourceId === null ? "NULL" : `'${o.resourceId}'`},
        ${o.idem === undefined || o.idem === null ? "NULL" : `'${o.idem}'`},
        '${o.start}'::timestamp,'${o.end}'::timestamp,'${status}',CURRENT_TIMESTAMP)`,
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

    // ---- 1. all six new tables exist ---------------------------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    check("all 6 appointment tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "6/6");

    // ---- 2. all seven new enums exist with the right label counts ----------
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
      "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
    );
    for (const [name, expected] of NEW_ENUMS) {
      const n = enums.filter((e) => e.typname === name).length;
      check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`);
    }

    // ---- 3. Booking gained exactly the intended columns -------------------
    const bookingCols = await prisma.$queryRawUnsafe<
      { column_name: string; is_nullable: string; column_default: string | null }[]
    >(
      "select column_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='Booking'",
    );
    for (const [col, nullable] of BOOKING_ADDED) {
      const found = bookingCols.find((c) => c.column_name === col);
      check(
        `Booking.${col} exists and is_nullable=${nullable}`,
        !!found && found.is_nullable === nullable,
        found ? `is_nullable=${found.is_nullable}` : "MISSING",
      );
    }
    const partySize = bookingCols.find((c) => c.column_name === "partySize");
    check(
      "Booking.partySize is NOT NULL but carries a default so existing rows stayed valid",
      !!partySize && partySize.is_nullable === "NO" && (partySize.column_default ?? "").includes("1"),
      partySize ? `default=${partySize.column_default}` : "MISSING",
    );

    // ---- 4. pre-existing Booking shape was NOT changed --------------------
    const status = bookingCols.find((c) => c.column_name === "status");
    check(
      "Booking.status is still text, not converted to an enum",
      !!status && status.is_nullable === "NO",
      status ? `nullable=${status.is_nullable}` : "MISSING",
    );
    const statusType = await prisma.$queryRawUnsafe<{ data_type: string }[]>(
      "select data_type from information_schema.columns where table_schema='public' and table_name='Booking' and column_name='status'",
    );
    check(
      "Booking.status data_type remains text",
      statusType[0]?.data_type === "text",
      `data_type=${statusType[0]?.data_type}`,
    );

    // ---- 5. the resource exclusion constraint exists and is narrow --------
    const excl = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      "select conname, pg_get_constraintdef(oid) as def from pg_constraint where contype='x'",
    );
    const bookingExcl = excl.find((e) => e.conname === "Booking_resource_no_overlap");
    check("exclusion constraint Booking_resource_no_overlap present", !!bookingExcl, bookingExcl ? "present" : "MISSING");
    check(
      "constraint guards resourceId IS NOT NULL so legacy bookings never conflict",
      !!bookingExcl && /resourceId.*IS NOT NULL/is.test(bookingExcl.def),
      bookingExcl ? bookingExcl.def.slice(0, 130) : "MISSING",
    );
    check(
      "constraint is restricted to occupying statuses only",
      !!bookingExcl && /CHECKED_IN/.test(bookingExcl.def) && /CONFIRMED/.test(bookingExcl.def),
      bookingExcl ? bookingExcl.def.slice(0, 160) : "MISSING",
    );
    // Wave A's constraint must have survived Wave B.
    check(
      "Wave A Reservation_no_overlap still present",
      excl.some((e) => e.conname === "Reservation_no_overlap"),
      excl.map((e) => e.conname).join(","),
    );

    // ---- 6. append-only trigger registered and ENFORCED ------------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["AppointmentEvent.UPDATE", "AppointmentEvent.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }

    for (const op of ["UPDATE", "DELETE"] as const) {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          const bid = `${RUN}_b_${op}`;
          await insertBooking(tx, {
            id: bid,
            profileId,
            serviceId,
            resourceId,
            start: "2033-01-01 09:00:00",
            end: "2033-01-01 10:00:00",
          });
          const eid = `${RUN}_e_${op}`;
          await tx.$executeRawUnsafe(
            `insert into "AppointmentEvent" ("id","bookingId","kind","to","actor") values ('${eid}','${bid}','CREATED','CONFIRMED','STAFF')`,
          );
          try {
            if (op === "UPDATE") {
              await tx.$executeRawUnsafe(`update "AppointmentEvent" set "to"='TAMPERED' where "id"='${eid}'`);
            } else {
              await tx.$executeRawUnsafe(`delete from "AppointmentEvent" where "id"='${eid}'`);
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
      check(`AppointmentEvent refuses ${op}`, refused && detail.length > 0, detail || "NO ERROR OBSERVED");
    }

    // ---- 7. overlapping bookings on the SAME resource are refused --------
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          await insertBooking(tx, {
            id: `${RUN}_ov_a`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-02-01 09:00:00",
            end: "2033-02-01 10:00:00",
          });
          try {
            await insertBooking(tx, {
              id: `${RUN}_ov_b`,
              profileId,
              serviceId,
              resourceId,
              start: "2033-02-01 09:30:00",
              end: "2033-02-01 10:30:00",
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
      // This is the single inverted assertion.
      check(
        "overlapping bookings on the same resource are refused",
        INVERT ? !refused : refused && detail.length > 0,
        detail || "NO ERROR OBSERVED",
      );
    }

    // ---- 8. bookings with NO resource never conflict (protects legacy) ---
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId } = await seed(tx);
          await insertBooking(tx, {
            id: `${RUN}_nr_a`,
            profileId,
            serviceId,
            resourceId: null,
            start: "2033-03-01 09:00:00",
            end: "2033-03-01 10:00:00",
          });
          await insertBooking(tx, {
            id: `${RUN}_nr_b`,
            profileId,
            serviceId,
            resourceId: null,
            start: "2033-03-01 09:00:00", // identical slot, no resource on either
            end: "2033-03-01 10:00:00",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check(
        "two resource-less bookings in the same slot are allowed (legacy flow unbroken)",
        accepted,
        detail || "accepted",
      );
    }

    // ---- 9. adjacent booking allowed (half-open range) ------------------
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          await insertBooking(tx, {
            id: `${RUN}_adj_a`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-04-01 09:00:00",
            end: "2033-04-01 10:00:00",
          });
          await insertBooking(tx, {
            id: `${RUN}_adj_b`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-04-01 10:00:00", // starts exactly when the first ends
            end: "2033-04-01 11:00:00",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("back-to-back booking at the exact boundary is allowed", accepted, detail || "accepted");
    }

    // ---- 10. terminal status frees the slot -----------------------------
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          await insertBooking(tx, {
            id: `${RUN}_term_a`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-05-01 09:00:00",
            end: "2033-05-01 10:00:00",
            status: "CANCELLED",
          });
          await insertBooking(tx, {
            id: `${RUN}_term_b`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-05-01 09:15:00",
            end: "2033-05-01 09:45:00",
            status: "CONFIRMED",
          });
          accepted = true;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("a cancelled appointment does not hold the slot", accepted, detail || "accepted");
    }

    // ---- 11. Booking idempotency key is unique per profile --------------
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          await insertBooking(tx, {
            id: `${RUN}_id_a`,
            profileId,
            serviceId,
            resourceId,
            start: "2033-06-01 09:00:00",
            end: "2033-06-01 10:00:00",
            idem: "dup-key",
          });
          try {
            await insertBooking(tx, {
              id: `${RUN}_id_b`,
              profileId,
              serviceId,
              resourceId,
              start: "2033-06-02 09:00:00", // no overlap; only the key repeats
              end: "2033-06-02 10:00:00",
              idem: "dup-key",
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
      check("duplicate Booking idempotencyKey within a profile is refused", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 12. reminder uniqueness makes scheduling idempotent -----------
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          const bid = `${RUN}_rem_b`;
          await insertBooking(tx, {
            id: bid,
            profileId,
            serviceId,
            resourceId,
            start: "2033-07-01 09:00:00",
            end: "2033-07-01 10:00:00",
          });
          const ins = `insert into "AppointmentReminder" ("id","bookingId","profileId","channel","sendAt","updatedAt") values ($1,'${bid}','${profileId}','EMAIL','2033-06-30 09:00:00'::timestamp,CURRENT_TIMESTAMP)`;
          await tx.$executeRawUnsafe(ins, `${RUN}_rem_1`);
          try {
            await tx.$executeRawUnsafe(ins, `${RUN}_rem_2`);
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
      check(
        "duplicate reminder for the same booking, channel and moment is refused",
        refused && detail.length > 0,
        detail || "NO ERROR",
      );
    }

    // ---- 13. one deposit per booking ----------------------------------
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          const bid = `${RUN}_dep_b`;
          await insertBooking(tx, {
            id: bid,
            profileId,
            serviceId,
            resourceId,
            start: "2033-08-01 09:00:00",
            end: "2033-08-01 10:00:00",
          });
          const ins = `insert into "AppointmentDeposit" ("id","bookingId","profileId","amountCents","updatedAt") values ($1,'${bid}','${profileId}',5000,CURRENT_TIMESTAMP)`;
          await tx.$executeRawUnsafe(ins, `${RUN}_dep_1`);
          try {
            await tx.$executeRawUnsafe(ins, `${RUN}_dep_2`);
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
      check("a second deposit on the same booking is refused", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 14. appointment event seq is monotonic -----------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { profileId, serviceId, resourceId } = await seed(tx);
          const bid = `${RUN}_seq_b`;
          await insertBooking(tx, {
            id: bid,
            profileId,
            serviceId,
            resourceId,
            start: "2033-09-01 09:00:00",
            end: "2033-09-01 10:00:00",
          });
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "AppointmentEvent" ("id","bookingId","kind","to","actor") values ('${RUN}_seq_e${i}','${bid}','STATUS','CONFIRMED','SYSTEM')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "AppointmentEvent" where "bookingId"='${bid}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("AppointmentEvent.seq is monotonic per booking", ordered, detail);
    }

    // ---- 15. zero residue --------------------------------------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "Booking" where "id" like '${RUN}%')
            + (select count(*) from "AppointmentEvent" where "id" like '${RUN}%')
            + (select count(*) from "AppointmentReminder" where "id" like '${RUN}%')
            + (select count(*) from "AppointmentDeposit" where "id" like '${RUN}%')
            + (select count(*) from "AppointmentResource" where "id" like '${RUN}%')
            + (select count(*) from "ServiceOffering" where "id" like '${RUN}%')
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
  console.log("All appointment schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
