/**
 * Guarded executor for P2-001 rehearsal SQL.
 *
 * Enforces the owner's five-step preflight before ANY destructive statement:
 *   1. parse the connection target and print ONLY the redacted database name
 *   2. run assertDisposableTarget
 *   3. require the database name to equal the authorized target EXACTLY
 *   4. confirm the external backup still exists and record its SHA-256
 *   5. abort if any assertion differs
 *
 * There is deliberately no bypass flag and no way to pass a connection string:
 * the target always comes from the environment and is always re-verified here.
 *
 * Usage:
 *   ts-node scripts/one-off/p2-guarded-sql.ts --file <path.sql> --confirm-destructive
 *   ts-node scripts/one-off/p2-guarded-sql.ts --preflight-only
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  assertDisposableTarget,
  parseDatabaseName,
  redactUrl,
} from "../lib/disposable-db";

/** The ONLY database this script may ever touch. */
const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const BACKUP_DIR = "C:\\Users\\shubh\\AppData\\Local\\Temp\\personalink-p2-rehearsal-backup";

function fail(msg: string): never {
  console.error(`ABORT: ${msg}`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function preflight(): { db: string; backup: string; sha256: string } {
  const url = process.env.DATABASE_URL;

  // Step 1 - redacted identity only. Never print the raw URL.
  console.log(`[1/5] target (redacted): ${redactUrl(url)}`);
  const db = parseDatabaseName(url);
  console.log(`[1/5] parsed database name: ${db}`);

  // Step 2 - the committed guard must accept it.
  let guarded: string;
  try {
    guarded = assertDisposableTarget(url);
  } catch (e) {
    fail(`assertDisposableTarget refused this target: ${(e as Error).message}`);
  }
  console.log(`[2/5] assertDisposableTarget: ALLOWED (${guarded})`);

  // Step 3 - exact-match allow-list. Case-sensitive AND case-insensitive checks.
  if (db !== AUTHORIZED_TARGET) {
    fail(`database name is not the authorized target.\n  expected: ${AUTHORIZED_TARGET}\n  actual:   ${db}`);
  }
  if (db.toLowerCase().includes("personalink") && db !== AUTHORIZED_TARGET) {
    fail("refusing a personalink-like name that is not the exact authorized target");
  }
  console.log(`[3/5] exact target match: OK`);

  // Step 4 - the external backup must still exist; record its SHA-256.
  if (!existsSync(BACKUP_DIR)) fail(`backup directory missing: ${BACKUP_DIR}`);
  const dumps = readdirSync(BACKUP_DIR)
    .filter((f: string) => f.endsWith(".dump"))
    .sort();
  if (dumps.length === 0) fail(`no .dump backup found in ${BACKUP_DIR}`);
  const backup = `${BACKUP_DIR}\\${dumps[dumps.length - 1]}`;
  const bytes = statSync(backup).size;
  if (bytes <= 0) fail(`backup is empty: ${backup}`);
  const sha256 = createHash("sha256").update(readFileSync(backup)).digest("hex");
  console.log(`[4/5] backup present: ${backup}`);
  console.log(`[4/5] backup bytes:   ${bytes}`);
  console.log(`[4/5] backup sha256:  ${sha256}`);

  console.log(`[5/5] all assertions satisfied - execution permitted`);
  return { db, backup, sha256 };
}

/** Split on statement boundaries, ignoring comments and blank lines. */
function statements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  preflight();

  if (process.argv.includes("--preflight-only")) {
    console.log("preflight-only: no statement executed");
    return;
  }

  const file = arg("--file");
  if (!file) fail("--file <path.sql> is required");
  if (!process.argv.includes("--confirm-destructive")) {
    fail("--confirm-destructive is required to execute SQL");
  }
  if (!existsSync(file)) fail(`sql file not found: ${file}`);

  const sql = readFileSync(file, "utf8");
  const stmts = statements(sql);
  console.log(`\nexecuting ${stmts.length} statement(s) from ${file}`);

  const prisma = new PrismaClient();
  try {
    // Re-assert inside the connected session: prove the server we are actually
    // attached to is the authorized database, not merely what the URL claimed.
    const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
      "select current_database() as db",
    );
    if (rows[0].db !== AUTHORIZED_TARGET) {
      fail(`connected database is ${rows[0].db}, not the authorized target`);
    }
    console.log(`connected database re-verified: ${rows[0].db}\n`);

    await prisma.$transaction(async (tx) => {
      for (const s of stmts) {
        const label = s.replace(/\s+/g, " ").slice(0, 78);
        await tx.$executeRawUnsafe(s);
        console.log(`  ok  ${label}`);
      }
    });
    console.log("\ntransaction committed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
