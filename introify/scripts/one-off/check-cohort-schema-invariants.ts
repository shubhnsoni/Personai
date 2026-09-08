/**
 * Wave D / D1 content and cohort schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens
 * inside a transaction that is deliberately rolled back.
 *
 * The assertions that matter most are the PROMOTION ones. This wave must build on the
 * pre-existing Course/CourseModule/CourseLesson tree, on Member, on CourseEnrollment and
 * on LessonCompletion — not fork a coaching-only content stack beside them. A schema that
 * quietly grew its own course, lesson, learner, file or progress table would pass a naive
 * "tables exist" check, so this harness asserts:
 *
 *   - every cohort foreign key points at the pre-existing model BY NAME
 *   - no Cohort* table carries a lesson-, learner-, file- or queue-shaped column
 *   - NO progress table exists, because progress must be derived from LessonCompletion
 *   - the one additive column on CourseEnrollment is nullable and its unique index
 *     leaves pre-existing NULL rows unconstrained
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-cohort-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";
const RUN = `wd1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const NEW_TABLES = [
  "Cohort", "CohortMembership", "CohortSession", "CohortAttendance",
  "CohortAssignment", "CohortSubmission", "CohortCertificate", "CohortEvent",
] as const;

/** Tables that must NOT exist, because the pre-existing ones already do the job. */
const FORBIDDEN_TABLES = [
  "CohortCourse", "CohortLesson", "CohortModule", "CohortLearner", "CohortMember",
  "CohortProgress", "LearnerProgress", "CohortDocument", "CohortFile", "CohortPayment",
  "CohortTask", "CohortReminder",
] as const;

const NEW_ENUMS: Array<[string, number]> = [
  ["CohortStatus", 5],
  ["CohortMembershipStatus", 5],
  ["CohortSessionStatus", 4],
  ["CohortAttendanceStatus", 4],
  ["CohortSubmissionState", 5],
  ["CohortCertificateState", 4],
  ["CohortRenewalState", 6],
  ["CohortEventKind", 10],
  ["CohortEventActor", 3],
];

/** The promotion contract: each link must point at the PRE-EXISTING model. */
const PROMOTION_FKS: Array<[string, string, string]> = [
  ["Cohort", "courseId", "Course"],
  ["Cohort", "profileId", "Profile"],
  ["CohortMembership", "enrollmentId", "CourseEnrollment"],
  ["CohortMembership", "renewalTaskJobId", "TaskJob"],
  ["CohortSession", "locationId", "Location"],
  ["CohortSubmission", "documentId", "ProfileDocument"],
  ["CohortCertificate", "documentId", "ProfileDocument"],
];

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}
/** Flipped individually by INVERT_ASSERTION=1; identical to checkInvertible() otherwise. */
function checkInvertible(name: string, pass: boolean, detail = "") {
  results.push({ name, pass: INVERT ? !pass : pass, detail });
}

function errLine(e: unknown): string {
  const lines = String((e as Error).message).split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    lines.find((l) => l.includes("append-only") || l.includes("ERROR") || l.includes("duplicate") || l.includes("violates")) ??
    lines[0] ?? "unknown error"
  ).slice(0, 130);
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type Seeded = {
  profileId: string;
  courseId: string;
  enrollmentId: string;
  cohortId: string;
  membershipId: string;
};

/** Seeds a real program → enrolment → cohort → membership chain. */
async function seed(tx: Tx, tag = "a"): Promise<Seeded> {
  const u = `${RUN}_u_${tag}`;
  const p = `${RUN}_p_${tag}`;
  const c = `${RUN}_c_${tag}`;
  const e = `${RUN}_e_${tag}`;
  const co = `${RUN}_co_${tag}`;
  const m = `${RUN}_m_${tag}`;
  await tx.$executeRawUnsafe(
    `insert into "User" ("id","clerkId","email","updatedAt") values ('${u}','clerk_${u}','${u}@example.test',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${p}','${u}','${p}','P ${p}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Course" ("id","profileId","title","updatedAt") values ('${c}','${p}','Program',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "CourseEnrollment" ("id","courseId","visitorEmail") values ('${e}','${c}','learner-${tag}@example.test')`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Cohort" ("id","profileId","courseId","code","title","updatedAt") values ('${co}','${p}','${c}','B-${tag}','Batch ${tag}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "CohortMembership" ("id","cohortId","enrollmentId","updatedAt") values ('${m}','${co}','${e}',CURRENT_TIMESTAMP)`,
  );
  return { profileId: p, courseId: c, enrollmentId: e, cohortId: co, membershipId: m };
}

/** Runs `body` inside a transaction that always rolls back, reporting whether it refused. */
async function refuses(body: (tx: Tx) => Promise<void>): Promise<{ refused: boolean; detail: string }> {
  let refused = false;
  let detail = "";
  try {
    await prismaRef!.$transaction(async (tx) => {
      try {
        await body(tx);
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
  return { refused, detail };
}

let prismaRef: PrismaClient | null = null;

async function main() {
  const url = process.env.DATABASE_URL;
  const db = parseDatabaseName(url);
  assertDisposableTarget(url);
  if (db !== AUTHORIZED_TARGET) {
    console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  prismaRef = prisma;
  try {
    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db");
    if (live[0].db !== AUTHORIZED_TARGET) {
      console.error(`ABORT: connected to ${live[0].db}`);
      process.exit(1);
    }

    // ---- 1. the eight new tables exist, and the forbidden forks do not ----
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    checkInvertible("all 8 cohort tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "8/8");

    const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t));
    checkInvertible(
      "no parallel course, lesson, learner, progress, file, payment or queue table was created",
      forked.length === 0,
      forked.join(",") || "none",
    );

    for (const t of ["Course", "CourseModule", "CourseLesson", "CourseEnrollment", "LessonCompletion", "Member"]) {
      checkInvertible(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING");
    }

    // ---- 2. the nine enums with correct label counts ---------------------
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
      "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
    );
    for (const [name, expected] of NEW_ENUMS) {
      const n = enums.filter((e) => e.typname === name).length;
      checkInvertible(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`);
    }
    checkInvertible(
      "CohortRenewalState carries NONE, so a membership that never renews is not mislabelled",
      enums.some((e) => e.typname === "CohortRenewalState" && e.enumlabel === "NONE"),
    );

    // ---- 3. PROMOTION: links point at the pre-existing models -----------
    const fks = await prisma.$queryRawUnsafe<{ tbl: string; def: string; conname: string }[]>(
      `select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
         from pg_constraint where contype='f' and connamespace='public'::regnamespace`,
    );
    for (const [table, column, target] of PROMOTION_FKS) {
      const found = fks.find(
        (f) =>
          f.tbl.replace(/"/g, "") === table &&
          f.def.includes(`"${column}"`) &&
          new RegExp(`REFERENCES\\s+"?${target}"?`).test(f.def),
      );
      checkInvertible(`${table}.${column} references the existing ${target}`, !!found, found ? "ok" : "MISSING");
    }

    // A forked system would show up as a cohort table with its own learner-, lesson-,
    // file- or queue-shaped columns. Assert none exists.
    const cohortCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; is_nullable: string; data_type: string }[]>(
      `select table_name, column_name, is_nullable, data_type from information_schema.columns
        where table_schema='public' and table_name like 'Cohort%'`,
    );
    const smells = cohortCols.filter((c) =>
      ["email", "phone", "visitorEmail", "videoUrl", "contentUrl", "fileUrl", "payload", "attempts", "leaseToken", "priceCents", "embedding"].includes(
        c.column_name,
      ),
    );
    checkInvertible(
      "no cohort table duplicates learner, lesson-content, payment or task-queue columns",
      smells.length === 0,
      smells.map((s) => `${s.table_name}.${s.column_name}`).join(",") || "none",
    );

    // Progress must be DERIVED. A cached percentage column is the smell to catch.
    const progressCols = cohortCols.filter((c) => /progress|percent|completedLessons|lessonsDone/i.test(c.column_name));
    checkInvertible(
      "no cohort table caches progress; it is derived from LessonCompletion",
      progressCols.length === 0,
      progressCols.map((s) => `${s.table_name}.${s.column_name}`).join(",") || "none",
    );

    // ---- 4. the ONE additive column on a pre-existing table -------------
    const enrollCols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
      `select column_name, is_nullable from information_schema.columns
        where table_schema='public' and table_name='CourseEnrollment'`,
    );
    const idem = enrollCols.find((c) => c.column_name === "idempotencyKey");
    checkInvertible("CourseEnrollment gained idempotencyKey", !!idem, idem ? "present" : "MISSING");
    checkInvertible("that column is NULLABLE, so existing rows are unaffected", idem?.is_nullable === "YES", `is_nullable=${idem?.is_nullable}`);
    for (const c of ["visitorEmail", "status", "progress", "paymentId", "enrolledAt", "completedAt"]) {
      checkInvertible(`pre-existing CourseEnrollment.${c} survived`, enrollCols.some((r) => r.column_name === c));
    }

    // Two NULL keys must coexist, or the migration would have broken existing rows.
    {
      let bothInserted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "nullkey");
          await tx.$executeRawUnsafe(
            `insert into "CourseEnrollment" ("id","courseId","visitorEmail") values ('${RUN}_n1','${s.courseId}','n1@example.test')`,
          );
          await tx.$executeRawUnsafe(
            `insert into "CourseEnrollment" ("id","courseId","visitorEmail") values ('${RUN}_n2','${s.courseId}','n2@example.test')`,
          );
          const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from "CourseEnrollment" where "courseId"='${s.courseId}' and "idempotencyKey" is null`,
          );
          bothInserted = Number(rows[0].n) === 3;
          detail = `null-key rows=${rows[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      checkInvertible("many enrolments with a NULL idempotency key coexist", bothInserted, detail);
    }

    // ---- 5. append-only trigger registered and ENFORCED -----------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["CohortEvent.UPDATE", "CohortEvent.DELETE"]) {
      checkInvertible(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }
    // The four earlier ledgers must still be armed; this migration reused their function.
    for (const want of ["ActivityEvent.UPDATE", "ReservationEvent.UPDATE", "AppointmentEvent.UPDATE", "CaseEvent.UPDATE"]) {
      checkInvertible(`pre-existing trigger ${want} still armed`, trg.includes(want), trg.includes(want) ? "armed" : `have: ${trg}`);
    }

    for (const op of ["UPDATE", "DELETE"] as const) {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, `t${op}`);
        const eid = `${RUN}_ev_${op}`;
        await tx.$executeRawUnsafe(
          `insert into "CohortEvent" ("id","cohortId","kind","to","actor") values ('${eid}','${s.cohortId}','CREATED','PLANNED','STAFF')`,
        );
        if (op === "UPDATE") {
          await tx.$executeRawUnsafe(`update "CohortEvent" set "to"='TAMPERED' where "id"='${eid}'`);
        } else {
          await tx.$executeRawUnsafe(`delete from "CohortEvent" where "id"='${eid}'`);
        }
      });
      // This is the single inverted assertion.
      const expected = refused && detail.length > 0;
      checkInvertible(`CohortEvent refuses ${op}`, expected, detail || "NO ERROR OBSERVED");
    }

    // ---- 6. uniqueness that makes idempotency and ordering real ---------
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupcode");
        await tx.$executeRawUnsafe(
          `insert into "Cohort" ("id","profileId","courseId","code","title","updatedAt") values ('${RUN}_dup','${s.profileId}','${s.courseId}','B-dupcode','Clash',CURRENT_TIMESTAMP)`,
        );
      });
      checkInvertible("cohort code is unique within a course", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupenroll");
        await tx.$executeRawUnsafe(
          `insert into "CohortMembership" ("id","cohortId","enrollmentId","updatedAt") values ('${RUN}_dm','${s.cohortId}','${s.enrollmentId}',CURRENT_TIMESTAMP)`,
        );
      });
      checkInvertible("one enrolment joins a cohort at most once", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupsess");
        const ins = (id: string) =>
          `insert into "CohortSession" ("id","cohortId","ordinal","title","startsAt","endsAt","updatedAt") values ('${id}','${s.cohortId}',1,'S',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
        await tx.$executeRawUnsafe(ins(`${RUN}_s1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_s2`));
      });
      checkInvertible("session ordinal is unique within a cohort", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupatt");
        await tx.$executeRawUnsafe(
          `insert into "CohortSession" ("id","cohortId","ordinal","title","startsAt","endsAt","updatedAt") values ('${RUN}_as','${s.cohortId}',1,'S',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        );
        const ins = (id: string) =>
          `insert into "CohortAttendance" ("id","sessionId","membershipId","status","updatedAt") values ('${id}','${RUN}_as','${s.membershipId}','PRESENT',CURRENT_TIMESTAMP)`;
        await tx.$executeRawUnsafe(ins(`${RUN}_a1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_a2`));
      });
      checkInvertible("attendance is recorded once per learner per session", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupsub");
        await tx.$executeRawUnsafe(
          `insert into "CohortAssignment" ("id","cohortId","ordinal","title","updatedAt") values ('${RUN}_asg','${s.cohortId}',1,'A',CURRENT_TIMESTAMP)`,
        );
        const ins = (id: string) =>
          `insert into "CohortSubmission" ("id","assignmentId","membershipId","updatedAt") values ('${id}','${RUN}_asg','${s.membershipId}',CURRENT_TIMESTAMP)`;
        await tx.$executeRawUnsafe(ins(`${RUN}_sub1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_sub2`));
      });
      checkInvertible("one submission per learner per assignment", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const s = await seed(tx, "dupcert");
        const ins = (id: string) =>
          `insert into "CohortCertificate" ("id","membershipId","updatedAt") values ('${id}','${s.membershipId}',CURRENT_TIMESTAMP)`;
        await tx.$executeRawUnsafe(ins(`${RUN}_ct1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_ct2`));
      });
      checkInvertible("a membership has at most one certificate", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx) => {
        const a = await seed(tx, "ser1");
        const b = await seed(tx, "ser2");
        await tx.$executeRawUnsafe(
          `insert into "CohortCertificate" ("id","membershipId","serial","state","updatedAt") values ('${RUN}_x1','${a.membershipId}','SER-DUP','ISSUED',CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(
          `insert into "CohortCertificate" ("id","membershipId","serial","state","updatedAt") values ('${RUN}_x2','${b.membershipId}','SER-DUP','ISSUED',CURRENT_TIMESTAMP)`,
        );
      });
      checkInvertible("a certificate serial is globally unique", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 7. defaults that keep an unissued record honest ----------------
    {
      let states = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "defaults");
          await tx.$executeRawUnsafe(
            `insert into "CohortCertificate" ("id","membershipId","updatedAt") values ('${RUN}_dc','${s.membershipId}',CURRENT_TIMESTAMP)`,
          );
          const rows = await tx.$queryRawUnsafe<{ st: string; serial: string | null; issued: Date | null }[]>(
            `select "state" st, "serial", "issuedAt" issued from "CohortCertificate" where "id"='${RUN}_dc'`,
          );
          const coh = await tx.$queryRawUnsafe<{ st: string }[]>(`select "status" st from "Cohort" where "id"='${s.cohortId}'`);
          const mem = await tx.$queryRawUnsafe<{ st: string; rn: string }[]>(
            `select "status" st, "renewalState" rn from "CohortMembership" where "id"='${s.membershipId}'`,
          );
          states = `cert=${rows[0].st} serial=${rows[0].serial} issuedAt=${rows[0].issued} cohort=${coh[0].st} membership=${mem[0].st}/${mem[0].rn}`;
          checkInvertible("a new certificate defaults to INELIGIBLE with no serial and no issue date",
            rows[0].st === "INELIGIBLE" && rows[0].serial === null && rows[0].issued === null, states);
          checkInvertible("a new cohort defaults to PLANNED", coh[0].st === "PLANNED", coh[0].st);
          checkInvertible("a new membership defaults to INVITED with renewal NONE",
            mem[0].st === "INVITED" && mem[0].rn === "NONE", `${mem[0].st}/${mem[0].rn}`);
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) checkInvertible("defaults probe completed", false, errLine(e));
      }
    }

    // ---- 8. seq is monotonic within a cohort ---------------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "seq");
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "CohortEvent" ("id","cohortId","kind","to","actor") values ('${RUN}_q${i}','${s.cohortId}','STATUS','RUNNING','SYSTEM')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "CohortEvent" where "cohortId"='${s.cohortId}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      checkInvertible("CohortEvent.seq is monotonic per cohort", ordered, detail);
    }

    // ---- 9. cascade reaches cohort rows but never shared records -------
    {
      let cascaded = false;
      let taskSurvived = false;
      let documentSurvived = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "cascade");
          const taskId = `${RUN}_task`;
          const docId = `${RUN}_doc`;
          await tx.$executeRawUnsafe(
            `insert into "TaskJob" ("id","payload","state","maxAttempts","nextAttemptAt","updatedAt") values ('${taskId}','{}','QUEUED',3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "ProfileDocument" ("id","profileId","type","title","sourceType","updatedAt") values ('${docId}','${s.profileId}','OTHER','Cert','UPLOAD',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `update "CohortMembership" set "renewalTaskJobId"='${taskId}' where "id"='${s.membershipId}'`,
          );
          await tx.$executeRawUnsafe(
            `insert into "CohortCertificate" ("id","membershipId","documentId","updatedAt") values ('${RUN}_cc','${s.membershipId}','${docId}',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(`delete from "Course" where "id"='${s.courseId}'`);
          const coh = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Cohort" where "id"='${s.cohortId}'`);
          const tj = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "TaskJob" where "id"='${taskId}'`);
          const pd = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "ProfileDocument" where "id"='${docId}'`);
          cascaded = Number(coh[0].n) === 0;
          taskSurvived = Number(tj[0].n) === 1;
          documentSurvived = Number(pd[0].n) === 1;
          detail = `cohorts=${coh[0].n} tasks=${tj[0].n} documents=${pd[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      checkInvertible("deleting a course cascades its cohorts", cascaded, detail);
      checkInvertible("cascading a cohort does NOT delete the shared TaskJob it referenced", taskSurvived, detail);
      checkInvertible("cascading a cohort does NOT delete the shared ProfileDocument it referenced", documentSurvived, detail);
    }

    // ---- 10. progress is derivable from the pre-existing tables --------
    {
      let derived = "";
      let ok = false;
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "derive");
          const modId = `${RUN}_mod`;
          await tx.$executeRawUnsafe(
            `insert into "CourseModule" ("id","courseId","title","updatedAt") values ('${modId}','${s.courseId}','M1',CURRENT_TIMESTAMP)`,
          );
          for (let i = 0; i < 4; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "CourseLesson" ("id","moduleId","title","updatedAt") values ('${RUN}_l${i}','${modId}','L${i}',CURRENT_TIMESTAMP)`,
            );
          }
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "LessonCompletion" ("id","enrollmentId","lessonId") values ('${RUN}_lc${i}','${s.enrollmentId}','${RUN}_l${i}')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ total: number; done: number }[]>(
            `select (select count(*)::int from "CourseLesson" l join "CourseModule" m on m."id"=l."moduleId" where m."courseId"='${s.courseId}') total,
                    (select count(*)::int from "LessonCompletion" where "enrollmentId"='${s.enrollmentId}') done`,
          );
          ok = Number(rows[0].total) === 4 && Number(rows[0].done) === 3;
          derived = `lessons=${rows[0].total} completed=${rows[0].done} => ${Math.round((Number(rows[0].done) / Number(rows[0].total)) * 100)}%`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) derived = errLine(e);
      }
      checkInvertible("progress is computable from CourseLesson and LessonCompletion alone", ok, derived);
    }

    // ---- 11. zero residue ---------------------------------------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "Cohort" where "id" like '${RUN}%')
            + (select count(*) from "CohortMembership" where "id" like '${RUN}%')
            + (select count(*) from "CohortSession" where "id" like '${RUN}%')
            + (select count(*) from "CohortAttendance" where "id" like '${RUN}%')
            + (select count(*) from "CohortAssignment" where "id" like '${RUN}%')
            + (select count(*) from "CohortSubmission" where "id" like '${RUN}%')
            + (select count(*) from "CohortCertificate" where "id" like '${RUN}%')
            + (select count(*) from "CohortEvent" where "id" like '${RUN}%')
            + (select count(*) from "CourseEnrollment" where "id" like '${RUN}%')
            + (select count(*) from "LessonCompletion" where "id" like '${RUN}%')
            + (select count(*) from "CourseLesson" where "id" like '${RUN}%')
            + (select count(*) from "CourseModule" where "id" like '${RUN}%')
            + (select count(*) from "Course" where "id" like '${RUN}%')
            + (select count(*) from "ProfileDocument" where "id" like '${RUN}%')
            + (select count(*) from "TaskJob" where "id" like '${RUN}%')
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
  console.log("All cohort schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
