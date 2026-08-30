"use strict";

/**
 * Disposable-database target resolution for the gate driver.
 *
 * The DB-backed harnesses must run against a disposable rehearsal database and
 * must never touch live `personalink`. This module rewrites the database name in
 * DATABASE_URL and then asserts the *result* — deliberately, because the
 * predecessor of this driver asserted a hardcoded constant against a literal it
 * had just assigned, so its abort branch was unreachable. Here the target can
 * come from the environment, so the assertion is live.
 *
 * Nothing in this module returns or logs a DSN. The only value ever surfaced for
 * display is the bare database NAME.
 */

/** Databases this driver refuses to point a harness at, ever. */
const LIVE_DENYLIST = ["personalink"];

/**
 * A target must look disposable. This is a positive assertion, not just an
 * absence of the live name, so a typo cannot silently land on a real database.
 */
const DISPOSABLE_PATTERN = /(^|_)(rehearsal|disposable|scratch|sandbox|schema_dev|tmp|temp|test)(_|$)/i;

/** Postgres identifier shape. Prevents smuggling a path or query into pathname. */
const SAFE_NAME = /^[A-Za-z0-9_]{1,63}$/;

class DatabaseTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseTargetError";
  }
}

/**
 * @param {object} options
 * @param {NodeJS.ProcessEnv} options.env
 * @param {string} options.defaultDatabaseName fallback when GATES_DATABASE_NAME is unset
 * @returns {{databaseName: string, originalDatabaseName: string, source: string,
 *            rewritten: boolean, unrecognisedOverride: boolean, effectiveUrl: string}}
 */
function resolveDatabaseTarget({ env, defaultDatabaseName }) {
  const raw = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";
  if (raw === "") {
    throw new DatabaseTargetError(
      "DATABASE_URL is not set. Populate aiclone/.env (or export it) before running the gates.",
    );
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new DatabaseTargetError("DATABASE_URL is not a parseable URL. (Value withheld.)");
  }

  const originalDatabaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  const override = typeof env.GATES_DATABASE_NAME === "string" ? env.GATES_DATABASE_NAME.trim() : "";
  const databaseName = override !== "" ? override : defaultDatabaseName;
  const source = override !== "" ? "GATES_DATABASE_NAME" : "manifest default";

  if (!SAFE_NAME.test(databaseName)) {
    throw new DatabaseTargetError(
      `Resolved target database name is not a plain identifier: ${JSON.stringify(databaseName)} (from ${source}).`,
    );
  }

  // Rewrite, then assert the rewritten value. Order matters: the assertion below
  // reads back what was actually installed on the URL, not the input variable.
  url.pathname = `/${databaseName}`;
  const installed = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (installed !== databaseName) {
    throw new DatabaseTargetError("Database-name rewrite did not take effect; refusing to run.");
  }
  if (LIVE_DENYLIST.includes(installed.toLowerCase())) {
    throw new DatabaseTargetError(
      `ABORT: refusing to run harnesses against protected database "${installed}" (source: ${source}).`,
    );
  }

  const unrecognisedOverride = !DISPOSABLE_PATTERN.test(installed);
  if (unrecognisedOverride && env.GATES_ALLOW_UNRECOGNISED_DATABASE !== "1") {
    throw new DatabaseTargetError(
      `ABORT: target database "${installed}" does not look disposable ` +
        "(expected one of rehearsal/disposable/scratch/sandbox/schema_dev/tmp/temp/test in the name). " +
        "Set GATES_ALLOW_UNRECOGNISED_DATABASE=1 only if you are certain it is throwaway.",
    );
  }

  return {
    databaseName: installed,
    originalDatabaseName,
    source,
    rewritten: installed !== originalDatabaseName,
    unrecognisedOverride,
    // Held for the child environment only. Never logged, never serialised.
    effectiveUrl: url.toString(),
  };
}

module.exports = {
  LIVE_DENYLIST,
  DISPOSABLE_PATTERN,
  DatabaseTargetError,
  resolveDatabaseTarget,
};
