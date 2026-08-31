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
 *       ALL_ITERATED_PATTERNS has a mandatory literal core ("://" + "@", or a
 *       keyword + "=" / ":", or the "sk_live_" / "sk_test_" prefix, or "@tcp(" /
 *       "@unix(", or a "user:password@host:" followed by a known database port),
 *       so its shortest possible match is several characters long, never zero.
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
 *
 * VOCABULARY. The long spellings were here from the start, and an adversarial
 * audit then walked straight past both of these:
 *     DB_PW=S3cr3tPassw0rd99
 *     pw: S3cr3tPassw0rd99
 * unreported AND unredacted, because the abbreviations real configuration
 * actually uses appeared in neither this vocabulary nor SECRET_ENV_NAMES. The key
 * is now
 *     [optional dotted / underscored prefix] + password|passwd|pwd|pw|pass
 * which admits DB_PW, DB_PASS, AIC_DB_PW, MYSQL_PWD, db.pass and redis-pass.
 * PGPASSWORD is spelled out separately: "PG" is glued to "PASSWORD" with no
 * separator for the prefix branch to split on.
 *
 * THE PREFIX MUST END IN `_`, `.` OR `-`, AND THAT IS LOAD-BEARING. An
 * unrestricted prefix promotes every word ENDING in a keyword to a credential
 * key — `bypass=true`, `compass=north`, `encompass=false` all match
 * `<anything>pass=<value>` — and a PASSWORD_KV finding is FATAL inside a
 * driver-authored summary. Prose never writes `by_pass=`, so demanding the
 * separator is what separates a configuration key from an English word.
 *
 * There is no suffix allowance, for the same reason. It is also why `passed=41`,
 * which the driver's own SUMMARY lines carry, cannot match: after `pass` the
 * pattern demands `=` or `:` and finds `e`.
 *
 * Shortest possible match "pw=" — three characters, never empty (T1).
 */
const PASSWORD_KV =
  /\b((?:[A-Za-z0-9_.-]{0,40}[_.-])?(?:password|passwd|pwd|pw|pass)|pgpassword)\s*["']?\s*[=:]\s*["']?([^\s"',;&)}\]]*)/gi;

/**
 * The two abbreviations that are also ordinary words in prose and code, WHEN THEY
 * CARRY NO QUALIFYING PREFIX. These are measured collisions, every one of them
 * real text from a tree on this machine rather than an imagined risk:
 *     let pass = true;                    pass: true
 *     // First pass: group messages       // Second pass: reconstruct the list
 *     debug("pw:android")                 debug("pw:adb:runCommand")
 * A two-to-four letter abbreviation is too weak an anchor to overrule that, so a
 * value under a BARE `pw` / `pass` must carry a digit before it is reported or
 * rewritten (isReportablePasswordValue). Every other spelling — `pwd`, `passwd`,
 * `password`, `pgpassword`, and ANY prefixed form such as `DB_PW` — keeps the
 * original no-floor behaviour, because none of those occurs in prose.
 *
 * What that gives up: an all-letter password written after a bare `pw:` or
 * `pass:`. It is still caught in every other context that identifies it as a
 * credential — a prefixed key, a longer keyword, a DSN userinfo, a quoted value —
 * so the loss is narrow, and it is a far better trade than a scanner that goes
 * red on `let pass = true;`.
 */
const BARE_SHORT_PASSWORD_KEYS = new Set(["pw", "pass"]);

/**
 * A quoted credential whose value CONTAINS WHITESPACE — the one assignment form
 * PASSWORD_KV structurally cannot finish. Its value class stops at the first
 * space, so `password='S3cr3t Passw0rd 99'` was rewritten to
 * `password='<redacted> Passw0rd 99'`: two thirds of the credential survived in
 * the log, and the finding's own sample carried it. libpq's keyword connection
 * string (`host=… user=… password='…'`) is exactly where that spelling lives.
 *
 * The value is captured as a plain bounded class up to the closing quote, and the
 * "contains whitespace" test is applied in JS instead of in the pattern: a regex
 * of the form `[^"]*[ \t][^"]*` backtracks quadratically on a long unterminated
 * quote, and a scanner that a log line can make slow is a scanner that hangs a
 * gate. A quoted value with no whitespace is left to PASSWORD_KV, which already
 * covers it, so the two never both fire on the same span.
 *
 * Shortest possible match `pw=" "` — six characters, never empty (T1).
 */
const QUOTED_PASSWORD_KV =
  /\b((?:[A-Za-z0-9_.-]{0,40}[_.-])?(?:password|passwd|pwd|pw|pass)|pgpassword)\s*[=:]\s*(?:"([^"\r\n]{1,200})"|'([^'\r\n]{1,200})')/gi;

/**
 * Go's database/sql DSN — `user:password@tcp(host:port)/dbname`, and its
 * `@unix(/var/run/mysqld.sock)` sibling. There is no `://` anywhere in it, so
 * URI_USERINFO_ANY never saw it and the entire credential passed through
 * unreported and unredacted.
 *
 * The anchor is the literal `@tcp(` / `@unix(`, never punctuation alone: that is
 * what keeps this pattern off `node_modules/@scope/pkg`, off
 * `git@github.com:org/repo.git` and off a mail address, none of which is followed
 * by a host-function call.
 *
 * Shortest possible match "a:b@tcp()" — nine characters, never empty (T1).
 */
const GO_TCP_DSN =
  /(?<![A-Za-z0-9_.\-:/@])([A-Za-z0-9_.+-]{1,64}):([^\s:@/\\"']{1,200})@(tcp|unix)\(([^\s()]{0,255})\)/g;

/**
 * A bare `user:password@host:PORT` with no scheme at all, admitted ONLY when the
 * port is a well-known database port. psql/mysql invocations, docker-compose
 * environment blocks and copy-pasted connection details all take this shape, and
 * none of them carries a scheme for URI_USERINFO_ANY to anchor on.
 *
 * WHY THE PORT LIST EXISTS. The general form of this — a bare `\S+:\S+@` match —
 * is DELIBERATELY REFUSED in this file and stays refused: it eats
 * `node_modules/@scope/…` paths, `git@host:path` remotes and mail addresses, and
 * it is anchored on nothing but punctuation. A known database port is a real
 * literal, so every finding this raises still has a reason it can name.
 *
 * The lookbehind keeps the pattern off a span a scheme already owns: in
 * `postgresql://gateuser:hunter2@127.0.0.1:5432/db` the userinfo is preceded by
 * `/`, so URI_USERINFO_ANY reports it once and this does not report it twice.
 * `(?![0-9])` rather than `\b` after the port stops `:54321` being read as 5432.
 *
 * Shortest possible match "a:b@c:6379" — ten characters, never empty (T1).
 */
const BARE_USERINFO_DB_PORT =
  /(?<![A-Za-z0-9_.\-:/@])([A-Za-z0-9_.+-]{1,64}):([^\s:@/\\"']{1,200})@([A-Za-z0-9_.-]{1,255}):(5432|5433|3306|3307|1433|27017|6379|8123|9000)(?![0-9])/g;

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
 * Patterns added when the credential-form survey closed the schemeless and
 * quoted-value gaps. They are iterated by scanForLeaks exactly like the four
 * above and are under exactly the same T1 obligation — the assertion below runs
 * over the UNION, so a pattern here that could match empty stops this file from
 * loading just the same.
 *
 * They live in a second object for one reason, and it is a boring one: the SIZE
 * of ITERATED_PATTERNS is itself pinned by a self-test case, and widening the
 * scanner must not force an edit to a guard whose meaning did not change. A
 * further case pins the size of the union, so neither set can grow unobserved.
 */
const ITERATED_PATTERNS_EXTENDED = {
  QUOTED_PASSWORD_KV,
  GO_TCP_DSN,
  BARE_USERINFO_DB_PORT,
};

/** The real obligation: every pattern this module iterates, in one object. */
const ALL_ITERATED_PATTERNS = { ...ITERATED_PATTERNS, ...ITERATED_PATTERNS_EXTENDED };

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
  // Probes for the schemeless / quoted forms. Each one is a truncation of a real
  // shape, so a future edit that makes any of these patterns optional-only is
  // caught at module load rather than in a gate run.
  "pw",
  "pw=",
  "pw:1",
  "pass=",
  "_pass=",
  "DB_PW=",
  "pw=''",
  "pw=' '",
  "pw=\"\"",
  "tcp()",
  "@tcp(",
  "a:b@tcp()",
  "a:b@unix(/x)",
  ":@",
  "a:b@c:",
  "a:b@c:5432",
  "a:b@c:54321",
  "postgres://user:pw@host:5432/db",
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

assertPatternsCannotMatchEmpty(ALL_ITERATED_PATTERNS);
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

/**
 * Length floors for the bare-substring literal channel. See isSafeBareLiteral.
 * A prose-shaped value needs to be long before it is safe to hunt for blindly;
 * a value carrying a digit or symbol is already unlikely to occur by accident.
 */
const PROSE_BARE_MIN = 16;
const MIXED_CLASS_BARE_MIN = 8;

/** Is this captured value worth reporting as a shape finding? */
function isSecretishValue(value, minLength = 1) {
  const text = String(value ?? "");
  if (text.length < minLength) return false;
  if (isPlaceholder(text)) return false;
  if (looksLikeDocumentation(text)) return false;
  return true;
}

/**
 * Report/rewrite decision for a PASSWORD_KV span.
 *
 * BOTH CHANNELS ASK THIS ONE QUESTION, ON PURPOSE. The usual asymmetry —
 * redact() over-approximates, scanForLeaks() under-approximates — is safe for a
 * tutorial DSN, whose rewriting costs a reader nothing. It is NOT safe here: a
 * redact() that fired on `pass = true` would rewrite a log it was asked to make
 * readable into `pass = <redacted>`, which is the mid-word corruption class this
 * file already had to fix once for short bare literals. So the digit condition on
 * the bare abbreviations is a property of the SPAN, and both channels read it the
 * same way.
 *
 * @param {string} key the matched key name, exactly as written in the text
 * @param {string} value the matched value
 */
function isReportablePasswordValue(key, value) {
  if (!isSecretishValue(value)) return false;
  if (!BARE_SHORT_PASSWORD_KEYS.has(String(key ?? "").toLowerCase())) return true;
  return /[0-9]/u.test(String(value ?? ""));
}

/**
 * Report/rewrite decision for a QUOTED_PASSWORD_KV span.
 *
 * A value with no whitespace belongs to PASSWORD_KV, which already covers it, so
 * this returns false for it and the two patterns never double-report. The
 * whitespace is then normalised to `_` before the value is judged, which is what
 * lets the existing documentation vocabulary recognise `"your password here"`
 * for what it is — isProse() cannot see past a space on its own.
 */
function isReportableQuotedPassword(key, value) {
  const text = String(value ?? "");
  if (!/\s/u.test(text)) return false;
  return isReportablePasswordValue(key, text.replace(/\s+/gu, "_"));
}

/** The value group of a QUOTED_PASSWORD_KV match: double-quoted, else single. */
function quotedPasswordValue(match) {
  return match[2] === undefined ? match[3] : match[2];
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
/**
 * Is this value safe to hunt for as a BARE SUBSTRING anywhere in an artefact?
 *
 * The bare-literal channel is the only one with no syntactic context to anchor
 * it: it replaces the value wherever it appears, so a value that also occurs
 * inside ordinary text produces a critical finding about innocent output. That
 * is not hypothetical. With `length >= 4` as the only test, a PGPASSWORD of
 * "post" made the driver report SECRET_LITERAL/critical against ITS OWN summary
 * and rewrote the database name mid-word:
 *     database: "postgres_rehearsal_20260826"  ->  "<redacted>gres_rehearsal_20260826"
 * "true" did the same to "trueDepth". On such a machine the gate can never go
 * green, and the corrupted output actively misleads whoever reads the failure.
 * This file already learned the lesson once for the DSN *username* (see the note
 * in collectSecretLiterals); the password and the SECRET_ENV_NAMES values still
 * went through unfiltered.
 *
 * The discriminator is incidental-collision risk, which is driven by length and
 * by whether the value is word-shaped:
 *   - prose-shaped (letters/._- only, so plausibly a real word): needs >= 16
 *     chars, because short lowercase words are exactly what collide;
 *   - anything with a digit or symbol: needs >= 8, since character variety makes
 *     an accidental match implausible.
 *
 * What this deliberately gives up: a SHORT password is no longer redacted when
 * it appears completely bare, with no surrounding syntax. It is still caught in
 * every context that identifies it as a credential - the whole-DSN literal, the
 * URI_USERINFO_ANY span, and the PASSWORD_KV / SECRET_ASSIGNMENT forms - so the
 * loss is narrow and bounded, and it is a far better trade than a gate that can
 * never pass. A short bare secret is also, by construction, weak evidence: any
 * 4-character string appears somewhere in a large enough corpus.
 *
 * @param {string} text already trimmed, non-empty, not a placeholder
 */
function isSafeBareLiteral(text) {
  if (text.length < MIXED_CLASS_BARE_MIN) return false;
  return isProse(text) ? text.length >= PROSE_BARE_MIN : true;
}

function collectSecretLiterals(env) {
  const literals = new Set();
  const add = (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text === "" || PLACEHOLDERS.has(text.toLowerCase())) return;
    if (!isSafeBareLiteral(text)) return;
    literals.add(text);
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

  // After URI_USERINFO_ANY, so a span a scheme already owns is gone before the
  // schemeless patterns look at it. Both replacements drop `<redacted>` where a
  // `user:password@` used to be, and neither pattern can match `<redacted>@…`
  // (its user class has no `<`, and no colon survives before the `@`), so both
  // stay idempotent. Both rewrite unconditionally, exactly as URI_USERINFO_ANY
  // does: a documentation DSN is rewritten too, because nothing innocent is
  // shaped like `user:pw@tcp(…)` or `user:pw@host:5432` and a reader loses
  // nothing. The reporting side is the one that under-approximates.
  out = out.replace(GO_TCP_DSN, (match, user, password, hostKind) => `${REDACTED}@${hostKind}(${REDACTED})`);

  out = out.replace(
    BARE_USERINFO_DB_PORT,
    (match, user, password, host, port) => `${REDACTED}@${REDACTED}:${port}`,
  );

  // The key TYPE is kept and the material is not: a reader needs to know a live
  // Clerk key leaked rather than a test one, and "sk_live_<redacted>" cannot be
  // re-matched by SK_KEY_SHAPE, so this stays idempotent.
  out = out.replace(SK_KEY_SHAPE, (match, kind) => `sk_${kind}_${REDACTED}`);

  // Before PASSWORD_KV, so a whitespace-bearing quoted value is replaced whole
  // rather than up to its first space. The result carries no whitespace inside the
  // quotes, so this pattern cannot match its own output.
  out = out.replace(QUOTED_PASSWORD_KV, (match, key, doubleQuoted, singleQuoted) => {
    const value = doubleQuoted === undefined ? singleQuoted : doubleQuoted;
    if (!isReportableQuotedPassword(key, value)) return match;
    return match.slice(0, match.length - value.length - 1) + REDACTED + match.slice(match.length - 1);
  });

  out = out.replace(PASSWORD_KV, (match, key, value) => {
    if (value === "" || PLACEHOLDERS.has(String(value).toLowerCase())) return match;
    // The same question the scan asks. A bare `pw` / `pass` whose value is prose
    // is left alone here too: rewriting `pass = true` to `pass = <redacted>`
    // corrupts innocent output, which is the defect class this file exists to
    // avoid, and it would put the two channels into open disagreement.
    if (!isReportablePasswordValue(key, value)) return match;
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
 *   DSN_TCP_PASSWORD          user:password@tcp(host:port)/db — Go's schemeless DSN
 *   DSN_BARE_USERINFO         user:password@host:5432 — no scheme, known database port
 *   PASSWORD_KV               password/passwd/pwd/pw/pass/pgpassword assignment,
 *                             with or without a DB_/MYSQL_-style prefix
 *   PASSWORD_KV_QUOTED        the same, quoted, with whitespace inside the value
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
      // The one condition is on a BARE `pw` / `pass`, whose collisions with prose
      // and code are real and measured — see BARE_SHORT_PASSWORD_KEYS.
      if (isReportablePasswordValue(match[1], match[2])) push("PASSWORD_KV", "shape");
    }

    for (const match of matchSpans(line, QUOTED_PASSWORD_KV)) {
      if (isReportableQuotedPassword(match[1], quotedPasswordValue(match))) push("PASSWORD_KV_QUOTED", "shape");
    }

    for (const match of matchSpans(line, GO_TCP_DSN)) {
      // Judge the password, so `user:password@tcp(host:port)/dbname` — the line
      // every Go driver README opens with — is documentation, not a finding.
      if (isSecretishValue(match[2])) push("DSN_TCP_PASSWORD", "shape");
    }

    for (const match of matchSpans(line, BARE_USERINFO_DB_PORT)) {
      if (isSecretishValue(match[2])) push("DSN_BARE_USERINFO", "shape");
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
  ITERATED_PATTERNS_EXTENDED,
  ALL_ITERATED_PATTERNS,
  BARE_SHORT_PASSWORD_KEYS,
  assertPatternsCannotMatchEmpty,
  collectSecretLiterals,
  isReportablePasswordValue,
  isReportableQuotedPassword,
  isSecretishValue,
  looksLikeDocumentation,
  matchSpans,
  patternCanMatchEmpty,
  redact,
  scanForLeaks,
  escapeRegExp,
};
