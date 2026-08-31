"use strict";

/**
 * Credential redaction and leak assertion for the gate driver.
 *
 * The driver must never emit a credential, password, DSN, API key or connection
 * string — not to the console, not into a summary, and not on the failure path. Two
 * mechanisms enforce that:
 *
 *   1. redact() rewrites every byte of harness output before it is written to a
 *      log file or echoed. It is idempotent, so a harness that already prints
 *      "postgresql://<redacted>@host/db" is left untouched.
 *   2. scanForLeaks() re-reads what was written and fails the run if anything
 *      got through. Findings never quote the secret: the reported sample is the
 *      redacted line.
 *
 * REDACTION OVER-APPROXIMATES, DETECTION UNDER-APPROXIMATES, AND THAT ASYMMETRY IS
 * DELIBERATE. redact() rewrites every credential-shaped span it sees, documentation
 * examples included, because rewriting a tutorial DSN costs a reader nothing.
 * scanForLeaks() does the opposite: it suppresses spans it can show to be
 * documentation, because its "shape" findings are FATAL inside driver-authored
 * summaries, and a scanner that goes red on `postgres://user:password@host/db`
 * trains its readers to ignore it. The two can only disagree in the safe
 * direction — a span redact() has already rewritten cannot become a finding,
 * because the value is no longer in the text. The fixed-point property
 * (scanForLeaks(redact(x)) === []) is asserted in selftest.js.
 *
 * WHAT IS DELIBERATELY NOT HERE: any entropy / base64 / "long random string"
 * heuristic. The driver's own summaries carry a manifest sha256, a git HEAD sha
 * and absolute paths; an entropy rule flags all three, and a shape finding in a
 * summary is fatal. Everything below is anchored on a keyword, a key prefix or a
 * URI userinfo, so the scanner has a reason for every finding it raises.
 *
 * ---------------------------------------------------------------------------
 * TERMINATION
 * ---------------------------------------------------------------------------
 * This module previously hung a gate run, and the hang was in the credential
 * check itself — the last line of defence failing into an infinite loop in
 * exactly the situation it exists to detect. Two properties now make that
 * impossible BY CONSTRUCTION rather than by a bounded loop counter. There is no
 * loop counter anywhere in this file, and none is needed.
 *
 *   T1. NO ITERATED PATTERN CAN MATCH THE EMPTY STRING. Every regex in
 *       ITERATED_PATTERNS has a mandatory literal core ("://" + "@", or a
 *       keyword + "=" / ":", or the "sk_live_" / "sk_test_" prefix), so its
 *       shortest possible match is several characters long, never zero.
 *       assertPatternsCannotMatchEmpty() proves that at MODULE LOAD: this file
 *       refuses to load if a future edit introduces an empty-matchable pattern,
 *       so the bad state cannot reach a gate run at all.
 *
 *   T2. THE ITERATION STEP ADVANCES, AND NOTHING OUTSIDE IT CAN REWIND IT.
 *       matchSpans() is the module's only iteration primitive. It builds a
 *       private RegExp and hands it to String.prototype.matchAll, whose
 *       specified step sets the search index past the end of each match (and
 *       advances it by one on a zero-length match, which T1 makes unreachable).
 *       The index therefore strictly increases and is bounded by the input
 *       length, so an iteration over a line of n characters performs at most n
 *       steps. No hand-written match loop and no manual index arithmetic exists
 *       in this file for a future edit to get wrong.
 *
 * That combination is what fixes the real bug this code shipped with. The old
 * scanner drove the MODULE-LEVEL regex objects with exec() while, inside the
 * loop body, redact() ran replace() on those same objects — and replace() with a
 * global regex resets lastIndex to 0 when it finishes. exec() then re-matched the
 * same occurrence forever, findings grew without bound, and the driver died on
 * memory. (The bug was real; one comment justifying it was not. It claimed
 * PASSWORD_KV "matches empty" because its value group is `*` — it does not: the
 * keyword and the `=` are mandatory, so `password=` is a nine-character match.
 * The rewind, not an empty match, was the whole fault.) matchSpans() removes the
 * shared object the rewind needed: the regex it iterates is created inside the
 * call, is never handed to replace(), and is unreachable from any other code.
 *
 * The rest of the module is straight-line: redact() performs a fixed number of
 * passes (one split/join per secret literal, one replace() per redaction
 * pattern) with no loop-until-stable, and every remaining loop is a `for` over a
 * finite array (lines, patterns, literals). decodeOnce() decodes once, not until
 * stable. Empty secret literals are skipped, so split("") can never explode a
 * text into characters.
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
 * Values that describe themselves as an example instead of being one. These
 * suppress a SHAPE finding only. They never suppress SECRET_LITERAL: a value
 * that is actually present in this process's environment stays critical even if
 * it is the word "password", because that is then a real credential that really
 * escaped.
 *
 * Kept deliberately short. "test", "admin" and "root" are NOT here — they are
 * plausible real development credentials, and suppressing them would trade a
 * false positive for a missed leak.
 */
const DOC_VALUE_WORDS = new Set([
  "password",
  "passwd",
  "secret",
  "secretkey",
  "secret_key",
  "apikey",
  "api_key",
  "token",
  "mypassword",
  "mysecretpassword",
  "yourpassword",
  "your_password",
  "your_secret",
  "your_secret_key",
  "your_api_key",
  "your-api-key",
  "changeme",
  "change_me",
  "example",
  "placeholder",
  "dummy",
  "fake",
  "sample",
  "todo",
  "tbd",
  "unset",
  "not_set",
  "notset",
  "xxx",
  "xxxx",
]);

/** A value that opens with one of these, and carries no digits, is prose. */
const DOC_VALUE_PREFIX =
  /^(?:your|my|our|example|sample|dummy|fake|placeholder|insert|replace|todo|tbd|changeme|change_me)[-_.]?/u;

/**
 * A value carrying a key-type prefix, split into that prefix and its material:
 * "sk_live_xxxxxxxx" -> ["sk_live_", "xxxxxxxx"], "whsec_7Hj9…" -> ["whsec_", "7Hj9…"].
 * The letters-then-underscore shape is what keeps a real password out of this
 * branch: "Tr0ub4dor_aaaa" has a digit inside the leading run, so it does not
 * match and its material is never treated as a placeholder.
 */
const KEY_PREFIXED = /^([A-Za-z]{1,8}(?:_(?:live|test|prod|dev))?_)(.+)$/u;

/** xxxxxxxx, ********, 00000000 — three or more of the same character. */
const REPEATED_CHAR = /^(.)\1{2,}$/u;

/**
 * scheme://<userinfo>@<authority> — matches with or without a password.
 * The authority is consumed too: a span like
 * "postgresql://<redacted>@127.0.0.1:5432/db" has no secret left in its
 * userinfo but is still a connection string, and the requirement is that no
 * connection string appears in driver output at all. The database name after the
 * authority is deliberately preserved, because which database a harness targeted
 * is the one part of a DSN that a reader legitimately needs.
 *
 * Shortest possible match "a://b@" — six characters, never empty (T1).
 */
const URI_USERINFO_ANY = /\b([A-Za-z][A-Za-z0-9+.-]*):\/\/([^\s/@]+)@([^\s/?#]*)/g;

/**
 * Splits a userinfo span into user and password. Anchored and NOT global: it is
 * used for a single exec() on one already-extracted span, so it has no lastIndex
 * to advance and cannot be iterated.
 */
const USERINFO_PASSWORD = /^([^:]*):([\s\S]*)$/;

/**
 * Schemes for which a userinfo with NO password is still reported. A DSN like
 * `postgres://user@host:5432/db` names a real account on a real database server
 * and belongs in nobody's log. Restricting the passwordless case to database
 * schemes keeps `git+ssh://git@github.com/org/repo.git` — which a harness may
 * legitimately print — out of the findings list. A userinfo that carries a
 * PASSWORD is reported for every scheme, database or not.
 */
const DATABASE_SCHEMES = new Set([
  "postgres",
  "postgresql",
  "pg",
  "prisma",
  "mysql",
  "mariadb",
  "mongodb",
  "mongodb+srv",
  "redis",
  "rediss",
  "mssql",
  "sqlserver",
  "clickhouse",
  "cockroachdb",
  "amqp",
  "amqps",
]);

/**
 * libpq / JDBC style key=value secrets. Covers KEY=v, KEY="v", KEY='v',
 * KEY = v, KEY:  v and `export KEY=v` (the \b matches after the space).
 * Shortest possible match "pwd=" — four characters, never empty (T1).
 */
const PASSWORD_KV = /\b(password|passwd|pwd|pgpassword)\s*["']?\s*[=:]\s*["']?([^\s"',;&)}\]]*)/gi;

/**
 * Assignment whose KEY NAME carries a secret word, for the same six assignment
 * forms as PASSWORD_KV. The keyword vocabulary is the one this repository
 * already uses in its own log-redaction assertions (scripts/one-off/
 * check-due-work-preview-api.ts asserts on
 * /(password|passwd|secret|token|apikey|api_key)\s*[:=]/), extended with the
 * access/private-key and credential/passphrase spellings.
 *
 * Two things it deliberately does not do:
 *   - It does not include the password family: PASSWORD_KV owns those and
 *     applies no length floor, which is stricter.
 *   - It does not match a bare "key": NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and
 *     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are publishable BY DESIGN (see
 *     aiclone/.env.example) and flagging them is a false positive.
 *
 * The 12-character value floor is what keeps it off the driver's own summaries,
 * where `"secretScan": {` and `"secretScan": null` appear.
 * Shortest possible match "secret=" + 12 — never empty (T1).
 */
const SECRET_ASSIGNMENT =
  /\b([A-Za-z0-9_.-]{0,40}(?:secret|token|apikey|api[_.-]key|access[_.-]key|private[_.-]key|credential|passphrase)[A-Za-z0-9_.-]{0,40})\s*["']?\s*[=:]\s*["']?([^\s"',;&)}\]]{12,})/gi;

/**
 * Clerk / Stripe secret key material: sk_live_… and sk_test_…, with or without an
 * assignment around it, so a key pasted bare into a log is caught too.
 *
 * The 20-character floor on the key material is what separates a key from prose
 * ABOUT keys: a comment naming the `sk_live_` prefix, or a documentation
 * placeholder like `sk_live_xxxxxxxx`, has no 20 characters of material after the
 * prefix and does not match. Real keys are far longer than the floor (Clerk 40+,
 * Stripe 24+). pk_live_ / pk_test_ are NOT matched: publishable keys are public.
 * Shortest possible match — 28 characters, never empty (T1).
 */
const SK_KEY_SHAPE = /\bsk_(live|test)_([A-Za-z0-9]{20,})\b/gu;

/**
 * Environment variables whose values are secrets and must never appear in output.
 * An explicit list, taken from aiclone/.env.example, NOT a name-shaped sweep of
 * the whole environment. A sweep was tried and rejected: `PWD` matches any
 * sensible "looks like a password variable" name test, its value is the current
 * directory, and promoting a directory path to a secret literal makes redact()
 * rewrite every path in every summary and makes scanForLeaks() report a critical
 * leak on the driver's own output. The same over-redaction trap is recorded a few
 * lines down for DSN usernames.
 */
const SECRET_ENV_NAMES = [
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "PGPASSWORD",
  "POSTGRES_PASSWORD",
];

/** Every regex this module ITERATES. T1 is asserted over exactly this set. */
const ITERATED_PATTERNS = {
  URI_USERINFO_ANY,
  PASSWORD_KV,
  SECRET_ASSIGNMENT,
  SK_KEY_SHAPE,
};

/**
 * Inputs used to hunt for a zero-length match at a position other than 0, which
 * `test("")` alone cannot find (a pattern can be non-empty at the start of the
 * subject and still match empty later — /(?<=a)b?/ does).
 */
const EMPTY_MATCH_PROBES = [
  "",
  " ",
  "a",
  "=",
  ":",
  "@",
  "://",
  "://@",
  "a://@",
  "a://b@",
  "password",
  "password=",
  "password =",
  "pwd:",
  "secret=",
  "secret=1",
  "sk_live_",
  "sk_test_x",
  "%3A",
  "postgres://user@host",
  "postgres://user:pw@host/db password=x secret=yyyyyyyyyyyy sk_live_" + "A1b2C3d4E5f6G7h8I9j0",
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The module's ONLY iteration primitive — see T2 in the header.
 *
 * The RegExp handed to matchAll is built here, so it is not shared with redact()
 * (which is what the historical rewind needed) and starts at index 0 whatever
 * the caller's pattern object has been doing. matchAll then iterates a further
 * clone of it, so even this local object is not mutated.
 */
function* matchSpans(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  yield* String(text).matchAll(new RegExp(pattern.source, flags));
}

/**
 * True when `pattern` can produce a zero-length match — the shape that makes an
 * exec()/replace() loop spin. Terminating even for a bad pattern: matchSpans's
 * step advances by one on an empty match, so this can be safely pointed at the
 * very thing it is rejecting.
 */
function patternCanMatchEmpty(pattern) {
  const unanchored = new RegExp(pattern.source, pattern.flags.replace(/[gy]/gu, ""));
  if (unanchored.test("")) return true;
  for (const probe of EMPTY_MATCH_PROBES) {
    for (const match of matchSpans(probe, pattern)) {
      if (match[0].length === 0) return true;
    }
  }
  return false;
}

/**
 * T1, enforced at module load. A pattern that can match empty is a latent hang,
 * so this file refuses to load rather than letting a gate run reach it. Exported
 * so the self-test can prove the guard is live by feeding it a bad pattern.
 */
function assertPatternsCannotMatchEmpty(patterns) {
  for (const [name, pattern] of Object.entries(patterns)) {
    if (patternCanMatchEmpty(pattern)) {
      throw new Error(
        `redact.js: pattern ${name} can match the empty string. That is the shape that made this ` +
          "scanner hang once already: a zero-length match leaves the search index where it was. " +
          "Give the pattern a mandatory core instead of relaxing this assertion.",
      );
    }
  }
  return true;
}

assertPatternsCannotMatchEmpty(ITERATED_PATTERNS);
assertPatternsCannotMatchEmpty({ USERINFO_PASSWORD });

function isPlaceholder(value) {
  return PLACEHOLDERS.has(String(value ?? "").toLowerCase());
}

/** Decode percent-escapes once. Not "until stable" — one pass, no loop. */
function decodeOnce(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // malformed escape: judge the raw span instead
  }
}

/** A value that describes itself as an example rather than being one. */
function looksLikeDocumentation(value) {
  const text = String(value ?? "").trim();
  if (text === "") return true;
  if (text.includes(REDACTED)) return true; // already redacted; this is what keeps redact() idempotent
  const lower = text.toLowerCase();
  if (DOC_VALUE_WORDS.has(lower)) return true;
  if (REPEATED_CHAR.test(text)) return true;
  if (text.startsWith("<") || text.startsWith("{") || text.startsWith("[")) return true;
  if (text.includes("${") || text.includes("{{")) return true; // ${CLERK_SECRET_KEY}
  // Prose-shaped only: a value with no digit at all AND a documentation opener.
  // Both conditions are required so that real key material, which is mixed
  // alphanumeric, is not suppressed by an unlucky prefix.
  if (isProse(text) && DOC_VALUE_PREFIX.test(lower)) return true;
  // A key-shaped value whose MATERIAL is the placeholder: CLERK_SECRET_KEY=sk_live_xxxxxxxx
  // is the documented form in every getting-started page, and going red on it is
  // how a scanner teaches people to ignore it.
  const keyed = KEY_PREFIXED.exec(text);
  if (keyed) {
    const material = keyed[2];
    const lastSegment = material.slice(material.lastIndexOf("_") + 1);
    if (REPEATED_CHAR.test(material) || REPEATED_CHAR.test(lastSegment)) return true;
    if (DOC_VALUE_WORDS.has(material.toLowerCase()) || DOC_VALUE_WORDS.has(lastSegment.toLowerCase())) return true;
    if (isProse(material) && DOC_VALUE_PREFIX.test(material.toLowerCase())) return true;
  }
  return false;
}

/** No digits at all — key material effectively never looks like this. */
function isProse(text) {
  return /^[A-Za-z_.-]+$/u.test(text);
}

/** Is this captured value worth reporting as a shape finding? */
function isSecretishValue(value, minLength = 1) {
  const text = String(value ?? "");
  if (text.length < minLength) return false;
  if (isPlaceholder(text)) return false;
  if (looksLikeDocumentation(text)) return false;
  return true;
}

/**
 * Which finding, if any, a `scheme://userinfo@` span deserves. Returns null when
 * the span carries nothing worth reporting (an already-redacted userinfo, a
 * documentation password, or a passwordless userinfo on a non-database scheme).
 */
function classifyDsnUserinfo(scheme, userinfo) {
  const raw = String(userinfo ?? "");
  if (isPlaceholder(raw) || raw.includes(REDACTED)) return null;

  const direct = USERINFO_PASSWORD.exec(raw);
  if (direct) return isSecretishValue(direct[2]) ? "DSN_WITH_PASSWORD" : null;

  // A percent-encoded ":" (or "@") hides the separator from the check above while
  // leaving a perfectly usable password in the text.
  const decoded = decodeOnce(raw);
  if (decoded !== raw) {
    const hidden = USERINFO_PASSWORD.exec(decoded);
    if (hidden) return isSecretishValue(hidden[2]) ? "DSN_ENCODED_PASSWORD" : null;
  }

  return DATABASE_SCHEMES.has(String(scheme).toLowerCase()) ? "DSN_USERINFO_NO_PASSWORD" : null;
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
  for (const key of SECRET_ENV_NAMES) add(env[key]);

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

  // The key TYPE is kept and the material is not: a reader needs to know a live
  // Clerk key leaked rather than a test one, and "sk_live_<redacted>" cannot be
  // re-matched by SK_KEY_SHAPE, so this stays idempotent.
  out = out.replace(SK_KEY_SHAPE, (match, kind) => `sk_${kind}_${REDACTED}`);

  out = out.replace(PASSWORD_KV, (match, key, value) => {
    if (value === "" || PLACEHOLDERS.has(String(value).toLowerCase())) return match;
    return match.slice(0, match.length - value.length) + REDACTED;
  });

  out = out.replace(SECRET_ASSIGNMENT, (match, key, value) => {
    if (value.includes(REDACTED) || PLACEHOLDERS.has(String(value).toLowerCase())) return match;
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
 *
 * Finding kinds:
 *   SECRET_LITERAL            a value from the environment, verbatim
 *   DSN_WITH_PASSWORD         scheme://user:password@…
 *   DSN_ENCODED_PASSWORD      scheme://user%3Apassword@… — separator percent-encoded
 *   DSN_USERINFO_NO_PASSWORD  scheme://user@… on a database scheme
 *   PASSWORD_KV               password/passwd/pwd/pgpassword assignment
 *   SECRET_ASSIGNMENT         a key name containing secret / token / api_key / …
 *   SECRET_KEY_SHAPE          sk_live_… / sk_test_… key material
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
        // The sample is the REDACTED line, never the raw one. Every pattern
        // scanned here has a matching pass in redact(), which is what makes that
        // safe; the self-test asserts the raw value is absent from the whole
        // findings structure, not merely from this field.
        sample: redact(line, secretLiterals).slice(0, 200),
      });
    };

    for (const literal of secretLiterals) {
      if (literal && line.includes(literal)) {
        push("SECRET_LITERAL", "critical");
        break;
      }
    }

    for (const match of matchSpans(line, URI_USERINFO_ANY)) {
      const kind = classifyDsnUserinfo(match[1], match[2]);
      if (kind) push(kind, "shape");
    }

    for (const match of matchSpans(line, PASSWORD_KV)) {
      // No length floor: the key names the field, so any real value is a leak.
      if (isSecretishValue(match[2])) push("PASSWORD_KV", "shape");
    }

    for (const match of matchSpans(line, SECRET_ASSIGNMENT)) {
      if (isSecretishValue(match[2], 12)) push("SECRET_ASSIGNMENT", "shape");
    }

    for (const match of matchSpans(line, SK_KEY_SHAPE)) {
      // Judge the key MATERIAL, not the prefix: sk_live_<docs>
      // is documentation, sk_live_<40 mixed chars> is a key.
      if (isSecretishValue(match[2], 20)) push("SECRET_KEY_SHAPE", "shape");
    }
  });

  return findings;
}

module.exports = {
  REDACTED,
  DATABASE_SCHEMES,
  ITERATED_PATTERNS,
  assertPatternsCannotMatchEmpty,
  collectSecretLiterals,
  isSecretishValue,
  looksLikeDocumentation,
  matchSpans,
  patternCanMatchEmpty,
  redact,
  scanForLeaks,
  escapeRegExp,
};
