/**
 * P2-001 schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write is
 * performed inside a transaction that is deliberately rolled back, so the harness
 * leaves the database byte-identical to how it found it.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node scripts/one-off/check-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";

const NEW_TABLES = [
  "Workspace", "Location", "Membership", "MembershipLocation",
  "Contact", "ContactSourceLink", "ActivityEvent", "TaskJob",
  "WorkflowRun", "AgentRun", "WorkflowStep", "ToolCall",
  "Approval", "CopilotAuditEvent",
] as const;

/** Legacy FKs onto pre-existing tables: all must be nullable so old rows stay valid. */
const LEGACY_FKS: Array<[string, string]> = [
  ["Workspace", "profileId"],
  ["Contact", "profileId"],
  ["ContactSourceLink", "profileId"],
  ["ActivityEvent", "profileId"],
  ["WorkflowRun", "profileId"],
];

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}

/** Prisma error messages begin with a blank line, so take the first meaningful one. */
function errLine(e: unknown): string {
  const lines = String((e as Error).message).split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => l.includes("append-only") || l.includes("ERROR")) ?? lines[0] ?? "unknown error").slice(0, 110);
}

class Rollback extends Error {}

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

    // ---- 1. all 14 new tables exist -------------------------------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    check("all 14 new tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "14/14");

    // ---- 2. enum + append-only function present -------------------------------
    const enumN = Number(
      (await prisma.$queryRawUnsafe<{ n: number }[]>("select count(*)::int n from pg_type where typname='MembershipRole'"))[0].n,
    );
    check("MembershipRole enum present", enumN === 1, `count=${enumN}`);
    const fnN = Number(
      (await prisma.$queryRawUnsafe<{ n: number }[]>("select count(*)::int n from pg_proc where proname='reject_append_only_mutation'"))[0].n,
    );
    check("append-only function present", fnN === 1, `count=${fnN}`);

    // ---- 3. legacy FK columns nullable ----------------------------------------
    for (const [t, c] of LEGACY_FKS) {
      const rows = await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
        `select is_nullable from information_schema.columns where table_schema='public' and table_name='${t}' and column_name='${c}'`,
      );
      const nullable = rows[0]?.is_nullable === "YES";
      check(`${t}.${c} is nullable`, INVERT ? !nullable : nullable, `is_nullable=${rows[0]?.is_nullable}`);
    }

    // ---- 4. append-only triggers registered for UPDATE and DELETE -------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["ActivityEvent.UPDATE", "ActivityEvent.DELETE", "CopilotAuditEvent.UPDATE", "CopilotAuditEvent.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }

    // ---- 5. append-only ENFORCEMENT actually refuses UPDATE and DELETE --------
    // Each attempt runs in its own transaction which is always rolled back.
    for (const op of ["UPDATE", "DELETE"] as const) {
      let refused = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const ws = `inv_ws_${op}_${Date.now()}`;
          const ct = `inv_ct_${op}_${Date.now()}`;
          const ae = `inv_ae_${op}_${Date.now()}`;
          await tx.$executeRawUnsafe(
            `insert into "Workspace" ("id","name","slug","updatedAt") values ('${ws}','inv','${ws}',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "Contact" ("id","workspaceId","confidence","updatedAt") values ('${ct}','${ws}','PROBABLE',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "ActivityEvent" ("id","contactId","type","sourceKind","sourceId","summary") values ('${ae}','${ct}','t','k','s','inv')`,
          );
          try {
            if (op === "UPDATE") {
              await tx.$executeRawUnsafe(`update "ActivityEvent" set "summary"='mutated' where "id"='${ae}'`);
            } else {
              await tx.$executeRawUnsafe(`delete from "ActivityEvent" where "id"='${ae}'`);
            }
          } catch (e) {
            refused = true;
            detail = errLine(e);
          }
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) {
          if (!refused) { refused = true; detail = errLine(e); }
        }
      }
      // An empty detail would mean we never actually observed a refusal message.
      check(`ActivityEvent refuses ${op}`, refused && detail.length > 0, detail || "NO ERROR OBSERVED");
    }

    // ---- 6. deterministic backfill + second-run idempotency -------------------
    // Projects Profile rows into Workspace/Contact with deterministic ids, twice,
    // asserting the second run is a no-op. Always rolled back.
    let firstRun = -1, secondRun = -1, profiles = -1;
    try {
      await prisma.$transaction(async (tx) => {
        profiles = Number((await tx.$queryRawUnsafe<{ n: number }[]>('select count(*)::int n from "Profile"'))[0].n);
        const proj = `insert into "Workspace" ("id","profileId","name","slug","updatedAt")
                      select 'bf_'||p."id", p."id", coalesce(p."displayName",'workspace'), 'bf-'||p."id", CURRENT_TIMESTAMP
                      from "Profile" p
                      on conflict ("id") do nothing`;
        await tx.$executeRawUnsafe(proj);
        firstRun = Number((await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Workspace" where "id" like 'bf_%'`))[0].n);
        await tx.$executeRawUnsafe(proj); // replay
        secondRun = Number((await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Workspace" where "id" like 'bf_%'`))[0].n);
        throw new Rollback();
      });
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }
    check("backfill projects every Profile row", firstRun === profiles, `profiles=${profiles} projected=${firstRun}`);
    check("backfill replay is idempotent", firstRun === secondRun, `first=${firstRun} second=${secondRun}`);

    // ---- 7. backfill left no residue -----------------------------------------
    const residue = Number(
      (await prisma.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Workspace" where "id" like 'bf_%' or "id" like 'inv_%'`))[0].n,
    );
    check("harness left zero residue", residue === 0, `residue rows=${residue}`);

    // ---- 8. pre-existing tables untouched by this harness ---------------------
    const profileCount = Number((await prisma.$queryRawUnsafe<{ n: number }[]>('select count(*)::int n from "Profile"'))[0].n);
    check("Profile row count stable", profileCount === profiles, `before=${profiles} after=${profileCount}`);
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
  console.log("All schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
