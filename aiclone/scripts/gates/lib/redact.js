"use strict";

/**
 * Credential redaction and leak assertion for the gate driver.
 *
 * The driver must never emit a credential, password, DSN or connection string —
 * not to the console, not into a summary, and not on the failure path. Two
 * mechanisms enforce that:
 *
 *   1. redact() rewrites every byte of harness output before it is written to a
 *      log file or echoed. It is idempotent, so a harness that already prints
 *      "postgresql://<redacted>@host/db" is left untouched.
 *   2. scanForLeaks() re-reads what was written and fails the run if anything
 *      got through. Findings never quote the secret: the reported sample is the
 *      redacted line.
 */

const REDACTED = "<redacted>";

/** Values that are already-redacted placeholders and must not be flagged. */
const PLACEHOLDERS = new Set([
  "<redacted>",
  "redacted",
  "***",
  "****",
  "*****",
  "********",
  "<hidden>",
  "<omitted>",
  "null",
  "undefined",
  "",
]);

/**
 * scheme://<userinfo>@<authority> — matches with or without a password.
 * The authority is consumed too: a span like
 * "postgresql://<redacted>@127.0.0.1:5432/db" has no secret left in its
 * userinfo but is still a connection string, and the requirement is that no
 * connection string appears in driver output at all. The database name after the
 * authority is deliberately preserved, because which database a harness targeted
 * is the one part of a DSN that a reader legitimately needs.
 */
const URI_USERINFO_ANY = /\b([A-Za-z][A-Za-z0-9+.-]*):\/\/([^\s/@]+)@([^\s/?#]*)/g;

/** scheme://user:password@host — a userinfo that actually carries a secret. */
const URI_USERINFO_WITH_PASSWORD = /\b([A-Za-z][A-Za-z0-9+.-]*):\/\/([^\s/@:]*):([^\s/@]*)@/g;

/** libpq / JDBC style key=value secrets. */
const PASSWORD_KV = /\b(password|passwd|pwd|pgpassword)\s*["']?\s*[=:]\s*["']?([^\s"',;&)}\]]*)/gi;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collect the literal secret strings that must never appear in output.
 * Only values long enough to be meaningful are used, so a one-character
 * password does not turn the scanner into a noise generator.
 */
function collectSecretLiterals(env) {
  const literals = new Set();
  const add = (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length >= 4 && !PLACEHOLDERS.has(text.toLowerCase())) literals.add(text);
  };

  for (const key of ["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"]) {
    const raw = env[key];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const dsn = raw.trim();
    add(dsn);
    try {
      const url = new URL(dsn);
      add(decodeURIComponent(url.password || ""));
      // Only the user:password pair, and only when a password actually exists.
      // Adding the bare username here over-redacts: a username like "postgres"
      // occurs in ordinary prose, and blanket-replacing it rewrote a harness's
      // own assertion label ("postgres://" became "<redacted>//") the first time
      // this ran, which is worse than useless when someone is reading a failure.
      // The username is still removed wherever it matters, because
      // URI_USERINFO_ANY replaces the whole userinfo of any scheme://…@host span.
      if (url.username && url.password) add(`${url.username}:${url.password}`);
    } catch {
      /* unparseable DSN: the whole-string literal above still covers it */
    }
  }
  for (const key of ["PGPASSWORD", "POSTGRES_PASSWORD"]) add(env[key]);

  return [...literals].sort((a, b) => b.length - a.length);
}

/**
 * Replace every credential-shaped span in `text`. Idempotent.
 * `secretLiterals` are replaced first so a bare password (no surrounding DSN)
 * is caught too.
 */
function redact(text, secretLiterals = []) {
  if (typeof text !== "string" || text === "") return text === undefined ? "" : String(text ?? "");
  let out = text;

  for (const literal of secretLiterals) {
    if (!literal) continue;
    out = out.split(literal).join(REDACTED);
  }

  out = out.replace(URI_USERINFO_ANY, (match, scheme, userinfo, authority) => {
    if (userinfo === REDACTED && authority === REDACTED) return match;
    return `${scheme}://${REDACTED}@${REDACTED}`;
  });

  out = out.replace(PASSWORD_KV, (match, key, value) => {
    if (value === "" || PLACEHOLDERS.has(String(value).toLowerCase())) return match;
    return match.slice(0, match.length - value.length) + REDACTED;
  });

  return out;
}

/**
 * Scan text for anything that survived redaction.
 *
 * severity:
 *   "critical" — a real credential from this process's environment escaped.
 *                Always fails the run, wherever it is found.
 *   "shape"    — a credential-shaped span with no known-secret content
 *                (for example a fixture password inside a harness log).
 *                Fatal in driver-authored summaries; recorded but not fatal in
 *                pass-through harness logs, which are third-party text.
 */
function scanForLeaks(text, { secretLiterals = [], label = "input" } = {}) {
  const findings = [];
  if (typeof text !== "string" || text === "") return findings;
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const push = (pattern, severity) => {
      findings.push({
        label,
        line: index + 1,
        pattern,
        severity,
        sample: redact(line, secretLiterals).slice(0, 200),
      });
    };

    for (const literal of secretLiterals) {
      if (literal && line.includes(literal)) {
        push("SECRET_LITERAL", "critical");
        break;
      }
    }

    /*
     * THESE LOOPS USE LOCAL REGEX COPIES, AND THAT IS A BUG FIX, NOT A STYLE CHOICE.
     *
     * `push` calls `redact(line, ...)` to build its sample, and `redact` does
     * `out.replace(PASSWORD_KV, ...)` on the MODULE-LEVEL regex. `String.prototype.replace` with a
     * global regex sets `lastIndex` back to 0 when it finishes. So the sequence was: exec finds a
     * match at index n -> push -> redact -> replace resets lastIndex to 0 -> control returns to this
     * loop -> exec matches the SAME occurrence again -> forever. `findings` grew without bound and the
     * driver hung, then died on memory.
     *
     * It was reachable. Harness logs are redacted before being written, so their values are
     * `<redacted>` - a PLACEHOLDER, so `push` never fires and the loop advanced by luck. But the
     * driver's own console text is scanned RAW, so any unredacted `password=<value>` written by the
     * driver itself hung the scan. That is the credential check - the last line of defence - failing
     * into an infinite loop in exactly the situation it exists to detect.
     *
     * Fresh instances per call means `redact`'s use of the shared regexes cannot rewind these.
     */
    const uriScan = new RegExp(URI_USERINFO_WITH_PASSWORD.source, URI_USERINFO_WITH_PASSWORD.flags);
    let match = uriScan.exec(line);
    while (match) {
      const password = match[3];
      if (!PLACEHOLDERS.has(String(password).toLowerCase())) push("DSN_WITH_PASSWORD", "shape");
      if (match.index === uriScan.lastIndex) uriScan.lastIndex += 1;
      match = uriScan.exec(line);
    }

    const kvScan = new RegExp(PASSWORD_KV.source, PASSWORD_KV.flags);
    match = kvScan.exec(line);
    while (match) {
      const value = match[2];
      if (value !== "" && !PLACEHOLDERS.has(String(value).toLowerCase())) push("PASSWORD_KV", "shape");
      // A zero-length match cannot advance lastIndex on its own: PASSWORD_KV's value group is `*`,
      // so `password=` with nothing after it matches empty and would spin here too.
      if (match.index === kvScan.lastIndex) kvScan.lastIndex += 1;
      match = kvScan.exec(line);
    }
  });

  return findings;
}

module.exports = {
  REDACTED,
  collectSecretLiterals,
  redact,
  scanForLeaks,
  escapeRegExp,
};
