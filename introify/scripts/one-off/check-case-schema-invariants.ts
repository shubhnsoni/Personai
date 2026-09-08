/**
 * Wave C / C1 cases and projects schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens
 * inside a transaction that is deliberately rolled back.
 *
 * The assertions that matter most are the COMPOSITION ones: this wave must reuse Contact,
 * TaskJob, Approval and ProfileDocument rather than duplicating them. A schema that
 * quietly grew its own parallel contact or task table would pass a naive "tables exist"
 * check, so the foreign keys are verified to point at the pre-existing models by name.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-case-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";
const RUN = `wc1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const NEW_TABLES = [
  "CaseIntake", "CaseProject", "CaseBrief", "CaseMilestone", "CaseDeliverable",
  "CaseDocumentRequest", "CaseInvoice", "CaseTaskLink", "CaseApprovalLink", "CaseEvent",
] as const;

const NEW_ENUMS: Array<[string, number]> = [
  ["CaseStatus", 7],
  ["CaseIntakeStatus", 5],
  ["CaseMilestoneStatus", 5],
  ["CaseDeliverableStatus", 5],
  ["CaseDocumentRequestStatus", 4],
  ["CaseInvoiceState", 7],
  // 10, not 9, since Wave G3, whose one non-additive statement appended RETAINER to this enum.
  // The count is not simply bumped: the assertion below names the label and pins its position,
  // so a reshuffle cannot hide behind a matching total.
  ["CaseEventKind", 10],
  ["CaseEventActor", 3],
];

/** Wave G3's single change to a pre-existing object, pinned by label and by position. */
const CASE_EVENT_KIND_ORDER = [
  "CREATED",
  "STATUS",
  "MILESTONE",
  "DELIVERABLE",
  "DOCUMENT",
  "INVOICE",
  "TASK",
  "APPROVAL",
  "RETAINER",
  "NOTE",
];

/** The composition contract: each link must point at the PRE-EXISTING model. */
const COMPOSITION_FKS: Array<[string, string, string]> = [
  ["CaseTaskLink", "taskJobId", "TaskJob"],
  ["CaseApprovalLink", "approvalId", "Approval"],
  ["CaseDeliverable", "documentId", "ProfileDocument"],
  ["CaseDocumentRequest", "documentId", "ProfileDocument"],
  ["CaseProject", "contactId", "Contact"],
  ["CaseIntake", "contactId", "Contact"],
  ["CaseProject", "workspaceId", "Workspace"],
  ["CaseIntake", "workspaceId", "Workspace"],
  ["CaseProject", "locationId", "Location"],
];

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
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

async function seed(tx: Tx): Promise<{ workspaceId: string; caseId: string }> {
  const ws = `${RUN}_ws`;
  const cs = `${RUN}_case`;
  await tx.$executeRawUnsafe(
    `insert into "Workspace" ("id","name","slug","updatedAt") values ('${ws}','WaveC','${ws}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "CaseProject" ("id","workspaceId","reference","title","updatedAt") values ('${cs}','${ws}','REF-1','Audit engagement',CURRENT_TIMESTAMP)`,
  );
  return { workspaceId: ws, caseId: cs };
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

    // ---- 1. all ten tables exist -------------------------------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    check("all 10 case tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "10/10");

    // The name clash that would have broken the existing portfolio model.
    check("the pre-existing Project model still exists untouched", tables.includes("Project"), "present");
    check("no table named CaseProjects or Cases was created by accident", !tables.includes("CaseProjects") && !tables.includes("Cases"));

    // ---- 2. all eight enums with correct label counts ---------------------
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string; ord: number }[]>(
      "select t.typname, e.enumlabel, e.enumsortorder::float8 as ord from pg_type t join pg_enum e on e.enumtypid=t.oid",
    );
    for (const [name, expected] of NEW_ENUMS) {
      const n = enums.filter((e) => e.typname === name).length;
      check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`);
    }

    // Wave G3 appended RETAINER to CaseEventKind. Pinning the whole ordered list, rather than
    // only the count, is what stops a future wave from swapping a label and leaving the total
    // unchanged. The order also matters because it is the order in schema.prisma - Postgres
    // cannot reorder an enum after the fact, so a mismatch here would be permanent.
    const caseKindOrder = enums
      .filter((e) => e.typname === "CaseEventKind")
      .sort((a, b) => a.ord - b.ord)
      .map((e) => e.enumlabel);
    check(
      "CaseEventKind reads exactly as schema.prisma declares it, RETAINER included and in position",
      caseKindOrder.length === CASE_EVENT_KIND_ORDER.length &&
        CASE_EVENT_KIND_ORDER.every((label, i) => caseKindOrder[i] === label),
      caseKindOrder.join(","),
    );

    // ---- 3. COMPOSITION: links point at the pre-existing models ----------
    const fks = await prisma.$queryRawUnsafe<{ tbl: string; def: string; conname: string }[]>(
      `select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
         from pg_constraint where contype='f' and connamespace='public'::regnamespace`,
    );
    for (const [table, column, target] of COMPOSITION_FKS) {
      const found = fks.find(
        (f) => f.tbl.replace(/"/g, "") === table && f.def.includes(`"${column}"`) && new RegExp(`REFERENCES\\s+"?${target}"?`).test(f.def),
      );
      check(`${table}.${column} references the existing ${target}`, !!found, found ? "ok" : "MISSING");
    }

    // A duplicate parallel system would show up as a case table with its own
    // contact-like or task-like columns. Assert none was created.
    const caseCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `select table_name, column_name from information_schema.columns
        where table_schema='public' and table_name like 'Case%'`,
    );
    const duplicateSmells = caseCols.filter((c) =>
      ["email", "phone", "payload", "attempts", "maxAttempts", "leaseToken", "embedding"].includes(c.column_name),
    );
    check(
      "no case table duplicates contact, task-queue or embedding columns",
      duplicateSmells.length === 0,
      duplicateSmells.map((d) => `${d.table_name}.${d.column_name}`).join(",") || "none",
    );

    // ---- 4. append-only trigger registered and ENFORCED -----------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["CaseEvent.UPDATE", "CaseEvent.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }
    // The earlier ledgers must still be armed; this migration reused their function.
    for (const want of ["ActivityEvent.UPDATE", "ReservationEvent.UPDATE", "AppointmentEvent.UPDATE"]) {
      check(`pre-existing trigger ${want} still armed`, trg.includes(want), trg.includes(want) ? "armed" : `have: ${trg}`);
    }

    for (const op of ["UPDATE", "DELETE"] as const) {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { caseId } = await seed(tx);
          const eid = `${RUN}_e_${op}`;
          await tx.$executeRawUnsafe(
            `insert into "CaseEvent" ("id","caseId","kind","to","actor") values ('${eid}','${caseId}','CREATED','INTAKE','STAFF')`,
          );
          try {
            if (op === "UPDATE") {
              await tx.$executeRawUnsafe(`update "CaseEvent" set "to"='TAMPERED' where "id"='${eid}'`);
            } else {
              await tx.$executeRawUnsafe(`delete from "CaseEvent" where "id"='${eid}'`);
            }
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) { refused = true; detail = errLine(e); }
      }
      // This is the single inverted assertion.
      const expected = op === "UPDATE" ? (INVERT ? !refused : refused && detail.length > 0) : refused && detail.length > 0;
      check(`CaseEvent refuses ${op}`, expected, detail || "NO ERROR OBSERVED");
    }

    // ---- 5. uniqueness constraints that make idempotency real -----------
    for (const [label, first, second] of [
      [
        "case reference is unique per workspace",
        `insert into "CaseProject" ("id","workspaceId","reference","title","updatedAt") values ('${RUN}_c1','WS','REF-DUP','A',CURRENT_TIMESTAMP)`,
        `insert into "CaseProject" ("id","workspaceId","reference","title","updatedAt") values ('${RUN}_c2','WS','REF-DUP','B',CURRENT_TIMESTAMP)`,
      ],
      [
        "case idempotencyKey is unique per workspace",
        `insert into "CaseProject" ("id","workspaceId","reference","title","idempotencyKey","updatedAt") values ('${RUN}_k1','WS','R1','A','KEY',CURRENT_TIMESTAMP)`,
        `insert into "CaseProject" ("id","workspaceId","reference","title","idempotencyKey","updatedAt") values ('${RUN}_k2','WS','R2','B','KEY',CURRENT_TIMESTAMP)`,
      ],
    ] as const) {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const ws = `${RUN}_uq`;
          await tx.$executeRawUnsafe(
            `insert into "Workspace" ("id","name","slug","updatedAt") values ('${ws}','U','${ws}',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(first.replace(/'WS'/g, `'${ws}'`));
          try {
            await tx.$executeRawUnsafe(second.replace(/'WS'/g, `'${ws}'`));
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) { refused = true; detail = errLine(e); }
      }
      check(label, refused && detail.length > 0, detail || "NO ERROR");
    }

    // Milestone ordinal must be unique within a case, which is what keeps a plan ordered.
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { caseId } = await seed(tx);
          const ins = (id: string) =>
            `insert into "CaseMilestone" ("id","caseId","title","ordinal","updatedAt") values ('${id}','${caseId}','M',1,CURRENT_TIMESTAMP)`;
          await tx.$executeRawUnsafe(ins(`${RUN}_m1`));
          try {
            await tx.$executeRawUnsafe(ins(`${RUN}_m2`));
          } catch (e) { refused = true; detail = errLine(e); }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) { refused = true; detail = errLine(e); }
      }
      check("milestone ordinal is unique within a case", refused && detail.length > 0, detail || "NO ERROR");
    }

    // One brief per case.
    {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { caseId } = await seed(tx);
          const ins = (id: string) =>
            `insert into "CaseBrief" ("id","caseId","objectives","updatedAt") values ('${id}','${caseId}','Obj',CURRENT_TIMESTAMP)`;
          await tx.$executeRawUnsafe(ins(`${RUN}_b1`));
          try {
            await tx.$executeRawUnsafe(ins(`${RUN}_b2`));
          } catch (e) { refused = true; detail = errLine(e); }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback) && !refused) { refused = true; detail = errLine(e); }
      }
      check("a case can have at most one brief", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 6. seq is monotonic within a case ------------------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { caseId } = await seed(tx);
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "CaseEvent" ("id","caseId","kind","to","actor") values ('${RUN}_s${i}','${caseId}','STATUS','ACTIVE','SYSTEM')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "CaseEvent" where "caseId"='${caseId}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("CaseEvent.seq is monotonic per case", ordered, detail);
    }

    // ---- 7. deleting a workspace cascades cases but not shared systems --
    {
      let cascaded = false;
      let taskSurvived = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const { workspaceId, caseId } = await seed(tx);
          const taskId = `${RUN}_task`;
          await tx.$executeRawUnsafe(
            `insert into "TaskJob" ("id","payload","state","maxAttempts","nextAttemptAt","updatedAt") values ('${taskId}','{}','QUEUED',3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "CaseTaskLink" ("caseId","taskJobId") values ('${caseId}','${taskId}')`,
          );
          await tx.$executeRawUnsafe(`delete from "Workspace" where "id"='${workspaceId}'`);
          const cases = await tx.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from "CaseProject" where "id"='${caseId}'`,
          );
          const tasks = await tx.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from "TaskJob" where "id"='${taskId}'`,
          );
          cascaded = Number(cases[0].n) === 0;
          taskSurvived = Number(tasks[0].n) === 1;
          detail = `cases=${cases[0].n} tasks=${tasks[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("deleting a workspace cascades its cases", cascaded, detail);
      check("cascading a case does NOT delete the shared TaskJob it referenced", taskSurvived, detail);
    }

    // ---- 8. zero residue -----------------------------------------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "CaseProject" where "id" like '${RUN}%')
            + (select count(*) from "CaseEvent" where "id" like '${RUN}%')
            + (select count(*) from "CaseMilestone" where "id" like '${RUN}%')
            + (select count(*) from "CaseBrief" where "id" like '${RUN}%')
            + (select count(*) from "TaskJob" where "id" like '${RUN}%')
            + (select count(*) from "Workspace" where "id" like '${RUN}%') as n`,
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
  console.log("All case schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
