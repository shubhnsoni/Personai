/**
 * THE CANONICAL HTTP METHOD CLASSIFIER, AND THE EVIDENCE THAT MIGRATING TO IT CHANGED NOTHING IT SHOULD NOT.
 *
 * Seven classifier sites across six harnesses were replaced by one. The risk in that change is not that
 * the new classifier is wrong in the abstract - it is that some consumer's verdict silently MOVES, and a
 * gate that used to be red goes green, or a gate that was green starts failing for a reason nobody
 * connects to this refactor. So this harness is built around that specific risk, in three layers:
 *
 *   1. SELF-TEST ON A SYNTHETIC CORPUS. Every verb in every declaration style, plus the shapes that
 *      distinguish an AST from a regex: a verb inside a comment, a verb inside a string, a nested
 *      declaration, an aliased re-export. The synthetic corpus exists because the REAL corpus contains
 *      none of these - measured, see below - so a claim about them has to be demonstrated rather than
 *      inferred from a corpus that cannot exercise it.
 *
 *   2. PER-CONSUMER EQUIVALENCE, on the exact files each consumer actually reads. Every one of the eight
 *      old patterns is reproduced here VERBATIM, as a historical artifact, and run against the same input
 *      it received before - raw source for the five sites that never stripped comments, comment-stripped
 *      source for the two that did. Old verdict and new verdict must agree, per consumer, per file. This
 *      is the assertion that would catch a migration that moved a verdict.
 *
 *   3. CORPUS-WIDE TWO-SIDED CROSS-CHECK. The AST and the widest regex are run over all 154 route files
 *      and disagreements are enumerated IN BOTH DIRECTIONS. A regex finding something the AST missed is
 *      just as much a finding as the reverse, and an AST that silently under-reports - on a file that
 *      failed to parse, say - would otherwise look like a clean pass.
 *
 * THE COUNTS ARE PINNED AS LITERALS, not read back out of the classifier. An expectation derived from the
 * thing under test is not an expectation. Where a number below is wrong because the repository grew, that
 * is the assertion doing its job: a new route file with a handler export should require somebody to look
 * at this list.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-http-method-classifier.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import {
    classifyRouteModule,
    describeMethods,
    exportsMethod,
    exportsNoStateChangingMethod,
    frameworkDerivesSafeMethods,
    HTTP_METHODS,
    SAFE_METHODS,
    SAFE_METHOD_HANDLERS,
    STATE_CHANGING_METHODS,
} from "../lib/http-method-classifier"

const INVERT = process.env.INVERT_ASSERTION === "1"
const APP_ROOT = join(__dirname, "../..")
const API_ROOT = join(APP_ROOT, "src/app/api")

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

// ---------------------------------------------------------------------------
// 0. The corpus
// ---------------------------------------------------------------------------
function routeFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...routeFiles(full))
        else if (entry === "route.ts") out.push(full)
    }
    return out
}

const corpus = routeFiles(API_ROOT).map((file) => ({
    file,
    rel: relative(API_ROOT, file).replace(/\\/g, "/"),
    src: readFileSync(file, "utf8"),
}))

/**
 * Comment-stripped source, reproduced EXACTLY as `check-due-work-preview-api.ts:executableLines` and
 * `check-operations-runtime.ts` do it, including the non-global per-line `//` replace and its `[^:]`
 * guard. This is a historical artifact and is deliberately not improved: the point of layer 2 is to
 * compare against what the old sites really did, and a better stripper here would compare against
 * something that never ran.
 */
function executableLines(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .split("\n")
        .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
        .join("\n")
}

checkInvertible(
    "the route corpus was found and is the size this harness's pinned counts were measured against",
    corpus.length === 154,
    `${corpus.length} route.ts files under src/app/api (pinned: 154)`,
)

// ---------------------------------------------------------------------------
// 1. Self-test: the declaration styles, and the shapes that separate an AST from a regex
// ---------------------------------------------------------------------------
/**
 * POSITIVE SHAPES. The first three are MEASURED to occur in this repository; the rest are legal Next.js
 * route exports that do not occur yet. Both groups are asserted, because a classifier that only handled
 * what exists today would need changing by the person who adds the first one - and that person is exactly
 * who will not notice.
 */
const POSITIVE_SHAPES: ReadonlyArray<readonly [string, string, string]> = Object.freeze([
    ["async function", "export async function VERB(request: Request): Promise<Response> { return Response.json({}) }", "MEASURED in repo"],
    ["function", "export function VERB(request: Request): Response { return Response.json({}) }", "MEASURED in repo"],
    ["const", "export const VERB = createHandler()", "MEASURED in repo"],
    ["const arrow", "export const VERB = async (request: Request) => Response.json({})", "legal, absent"],
    ["const typed", "export const VERB: (r: Request) => Response = (r) => Response.json({})", "legal, absent"],
    ["let", "export let VERB = createHandler()", "legal, absent"],
    ["var", "export var VERB = createHandler()", "legal, absent"],
    ["multiline function", "export async function VERB(\n    request: Request,\n): Promise<Response> {\n    return Response.json({})\n}", "legal, absent"],
    ["re-export alias", 'const handler = () => Response.json({})\nexport { handler as VERB }', "legal, absent - NO old site covered this"],
])

for (const [label, template, provenance] of POSITIVE_SHAPES) {
    const missed = HTTP_METHODS.filter((verb) => {
        const classified = classifyRouteModule(`synthetic/${label}/${verb}/route.ts`, template.replace(/VERB/g, verb))
        return !exportsMethod(classified, verb)
    })
    checkInvertible(
        `self-test: the classifier recognises \`${label}\` for all ${HTTP_METHODS.length} methods (${provenance})`,
        missed.length === 0,
        missed.length > 0 ? `MISSED: ${missed.join(",")}` : `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS all recognised`,
    )
}

/**
 * NEGATIVE SHAPES - the whole reason this is an AST and not a regex.
 *
 * Every one of these makes a raw-source regex answer "a handler is exported here" when none is. Five of
 * the eight old sites tested raw source, and the first shape below is the exact comment style this
 * repository uses to document a prohibition - which it has mistaken for a violation five times by its own
 * count.
 */
const NEGATIVE_SHAPES: ReadonlyArray<readonly [string, string]> = Object.freeze([
    ["a verb export named in a line comment", "// export async function POST(request: Request) - deliberately absent\nexport async function GET() { return Response.json({}) }"],
    ["a verb export named in a block comment", "/**\n * No `export async function POST` exists on this surface.\n */\nexport async function GET() { return Response.json({}) }"],
    ["a verb export inside a string literal", 'export async function GET() { return Response.json({ note: "export async function POST is forbidden here" }) }'],
    ["a verb export inside a template literal", "export async function GET() { return Response.json({ note: `export const POST = x` }) }"],
    ["a NESTED, unexported function named for a verb", "export async function GET() {\n    function POST() { return 1 }\n    return Response.json({ n: POST() })\n}"],
    ["an unexported top-level function named for a verb", "async function POST() { return Response.json({}) }\nexport async function GET() { return Response.json({}) }"],
    ["a re-export whose LOCAL name is the verb but whose EXPORTED name is not", "const POST = () => Response.json({})\nexport { POST as internalHandler }"],
])

for (const [label, source] of NEGATIVE_SHAPES) {
    const classified = classifyRouteModule("synthetic/negative/route.ts", source)
    checkInvertible(
        `self-test: ${label} is NOT classified as a state-changing export`,
        exportsNoStateChangingMethod(classified),
        `stateChanging=[${classified.stateChanging.join(",")}] methods=[${describeMethods(classified)}]`,
    )
}

/**
 * THE DIFFERENCE, DEMONSTRATED RATHER THAN ASSERTED, IN BOTH DIRECTIONS.
 *
 * The widest of the old regexes is run against the same corpus so that the AST's advantage is a
 * measurement instead of a preference. The count is pinned EXACTLY, not as "at least": the first version
 * of this assertion said `>= 5` and the measured answer is 4, which is the assertion catching its author
 * over-claiming. Being precise about it is the difference between evidence and decoration.
 *
 * FALSE POSITIVES - 4 of the 7 negative shapes. The regex reports a state-changing export where none
 * exists, on the comment and string shapes. It is CORRECT on the other three, and for two different
 * reasons worth separating: on both nested/unexported shapes it is correct BY CONSTRUCTION, because it
 * requires the `export` keyword; on the aliased re-export it is correct only BY INABILITY, because it
 * cannot match an export clause at all - which is the same inability that produces the false negative
 * below.
 */
const WIDEST_OLD_STATE_CHANGING = /\bexport\s+(?:(?:async\s+)?function|const|let|var)\s+(?:POST|PUT|PATCH|DELETE)\b/
const regexFooledBy = NEGATIVE_SHAPES.filter(([, source]) => WIDEST_OLD_STATE_CHANGING.test(source)).map(([label]) => label)
checkInvertible(
    "MEASURED: the widest OLD regex FALSE-POSITIVES on exactly the 4 comment and string shapes, and is correct on the 3 nesting and aliasing shapes - the precise concrete difference",
    regexFooledBy.length === 4 &&
        regexFooledBy.every((label) => label.includes("comment") || label.includes("string") || label.includes("template")),
    `false positives ${regexFooledBy.length}/${NEGATIVE_SHAPES.length}: ${regexFooledBy.join(" | ")}`,
)

/**
 * FALSE NEGATIVE, AND THIS IS THE SERIOUS DIRECTION.
 *
 * `export { handler as POST }` is a working POST handler - the framework dispatches on the EXPORTED name -
 * and not one of the eight old patterns contains an alternative that can match an export clause. So a
 * write verb added to any guarded route in that shape would have passed every single one of the eight
 * gates as "no state-changing verb exported". A false positive costs a red gate somebody investigates; a
 * false negative costs the guarantee silently, which is why this is asserted separately from the shapes
 * above rather than being folded into one count.
 *
 * MEASURED: no route file in this tree uses the shape today, so this is a closed hole rather than a caught
 * defect. The AST closes it by construction; the old regexes could not have been patched into closing it
 * without becoming a parser.
 */
const ALIASED_WRITE_REEXPORT = "const handler = async () => Response.json({})\nexport { handler as POST }"
const aliasedClassified = classifyRouteModule("synthetic/alias/route.ts", ALIASED_WRITE_REEXPORT)
checkInvertible(
    "MEASURED: an aliased re-export of a POST handler is a FALSE NEGATIVE for every one of the eight old patterns, and the canonical classifier catches it - the hole that mattered",
    !WIDEST_OLD_STATE_CHANGING.test(ALIASED_WRITE_REEXPORT) &&
        aliasedClassified.stateChanging.join(",") === "POST" &&
        aliasedClassified.exports.length === 1 &&
        aliasedClassified.exports.every((entry) => entry.style === "re-export"),
    `old regex sees no write verb; canonical classifier sees [${aliasedClassified.stateChanging.join(",")}] as ${aliasedClassified.exports.map((e) => e.style).join(",")}`,
)

// HEAD and OPTIONS are SAFE (RFC 9110 section 9.2.1). This is the invariant that a previous round got
// wrong by folding them into a set named for write verbs, so it is asserted directly.
checkInvertible(
    "HEAD and OPTIONS are NEVER classified as state-changing, in ANY declaration style - RFC 9110 section 9.2.1",
    POSITIVE_SHAPES.every(([label, template]) =>
        SAFE_METHOD_HANDLERS.every((verb) => {
            const classified = classifyRouteModule(`synthetic/${label}/${verb}/route.ts`, template.replace(/VERB/g, verb))
            return exportsMethod(classified, verb) && classified.stateChanging.length === 0
        }),
    ),
    `HEAD and OPTIONS recognised as handlers and excluded from stateChanging across all ${POSITIVE_SHAPES.length} styles`,
)
check(
    "the published method sets are the RFC ones and do not overlap",
    STATE_CHANGING_METHODS.join(",") === "POST,PUT,PATCH,DELETE" &&
        SAFE_METHODS.join(",") === "GET,HEAD,OPTIONS" &&
        SAFE_METHOD_HANDLERS.join(",") === "HEAD,OPTIONS" &&
        STATE_CHANGING_METHODS.length === 4 &&
        STATE_CHANGING_METHODS.every((m) => !SAFE_METHODS.includes(m)),
    `state-changing=[${STATE_CHANGING_METHODS.join(",")}] safe=[${SAFE_METHODS.join(",")}]`,
)
// A GET-only route is the precondition for the framework deriving HEAD and OPTIONS; a route that exports
// HEAD is not, and the predicate must say so rather than treating the export as an error.
check(
    "frameworkDerivesSafeMethods is true for a GET-only route and false once HEAD is exported - a derivation fact, not a prohibition",
    frameworkDerivesSafeMethods(classifyRouteModule("s/route.ts", "export async function GET() { return Response.json({}) }")) &&
        !frameworkDerivesSafeMethods(
            classifyRouteModule("s/route.ts", "export async function GET() { return Response.json({}) }\nexport async function HEAD() { return new Response(null) }"),
        ) &&
        exportsNoStateChangingMethod(
            classifyRouteModule("s/route.ts", "export async function GET() { return Response.json({}) }\nexport async function HEAD() { return new Response(null) }"),
        ),
    "exporting HEAD ends the derivation and still leaves the no-write guarantee intact",
)

// ---------------------------------------------------------------------------
// 2. The real corpus, counted - the inventory numbers, pinned
// ---------------------------------------------------------------------------
type StyleTally = Record<string, { asyncFunction: number; plainFunction: number; constDecl: number }>
const tally: StyleTally = {}
for (const verb of HTTP_METHODS) tally[verb] = { asyncFunction: 0, plainFunction: 0, constDecl: 0 }
for (const { file, src } of corpus) {
    const classified = classifyRouteModule(file, src)
    for (const entry of classified.exports) {
        if (entry.style === "async function") tally[entry.method].asyncFunction += 1
        else if (entry.style === "function") tally[entry.method].plainFunction += 1
        else if (entry.style === "const") tally[entry.method].constDecl += 1
    }
}
const stateChangingTotal = (key: keyof StyleTally[string]) =>
    STATE_CHANGING_METHODS.reduce((sum, verb) => sum + tally[verb][key], 0)

// These three numbers are quoted in the prose of check-operations-runtime.ts and
// check-due-work-preview-api.ts as the justification for widening their gates. Re-measured here with the
// AST, so the justification and the code cannot drift apart.
checkInvertible(
    "MEASURED: the state-changing declaration-style split is 95 async / 17 plain / 4 const, the figures the two widened gates cite as their justification",
    stateChangingTotal("asyncFunction") === 95 && stateChangingTotal("plainFunction") === 17 && stateChangingTotal("constDecl") === 4,
    `async=${stateChangingTotal("asyncFunction")} plain=${stateChangingTotal("plainFunction")} const=${stateChangingTotal("constDecl")}`,
)
checkInvertible(
    "MEASURED: 26 route files declare GET as `export function GET` and 2 as `export const GET` - the 28 files the narrow `export async function GET(` pattern cannot see",
    tally.GET.plainFunction === 26 && tally.GET.constDecl === 2,
    `export function GET=${tally.GET.plainFunction}, export const GET=${tally.GET.constDecl}, export async function GET=${tally.GET.asyncFunction}`,
)
// Nothing exports a safe-method handler today. That is what makes the safe-method split latent rather than
// load-bearing, and it is asserted so the claim stops being made the day it stops being true.
checkInvertible(
    "MEASURED: no route file in the corpus exports HEAD or OPTIONS, so the framework derives both on every route that exports GET",
    SAFE_METHOD_HANDLERS.length === 2 &&
        SAFE_METHOD_HANDLERS.every((verb) => tally[verb].asyncFunction + tally[verb].plainFunction + tally[verb].constDecl === 0),
    `HEAD=${JSON.stringify(tally.HEAD)} OPTIONS=${JSON.stringify(tally.OPTIONS)}`,
)

// ---------------------------------------------------------------------------
// 3. Per-consumer equivalence, against the files each consumer really reads
// ---------------------------------------------------------------------------
/**
 * The eight old sites (across seven harnesses - check-blueprint-preview.ts holds two), reproduced verbatim. `stripped` records whether that site fed itself
 * comment-stripped source, because feeding a site the wrong input would prove equivalence with something
 * that never ran.
 *
 * `getPattern` / `writePattern` are `null` where a site made no claim about that half.
 */
type OldSite = Readonly<{
    consumer: string
    site: string
    targets: readonly string[]
    stripped: boolean
    getPattern: RegExp | null
    writePattern: RegExp
}>

const OLD_SITES: readonly OldSite[] = Object.freeze([
    {
        consumer: "check-due-work-preview-api.ts",
        site: "STATE_CHANGING_VERB_EXPORT / GET_EXPORT (lines 216-218)",
        targets: ["src/app/api/platform/operations/due-work/route.ts"],
        stripped: true,
        getPattern: /export\s+(?:async\s+)?(?:function|const)\s+GET\b/,
        writePattern: /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/,
    },
    {
        consumer: "check-operations-runtime.ts",
        site: "STATE_CHANGING_VERB_EXPORT / GET_EXPORT (lines 159-161)",
        targets: ["src/app/api/platform/operations/today/route.ts"],
        stripped: true,
        getPattern: /export\s+(?:async\s+)?(?:function|const)\s+GET\b/,
        writePattern: /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/,
    },
    {
        consumer: "check-blueprint-preview.ts",
        site: "narrow preview-route gate (lines 143-146)",
        targets: [
            "src/app/api/platform/blueprints/route.ts",
            "src/app/api/platform/blueprints/[blueprintId]/preview/route.ts",
        ],
        stripped: false,
        getPattern: /export async function GET\(/,
        writePattern: /export async function (POST|PATCH|PUT|DELETE)\(/,
    },
    {
        consumer: "check-blueprint-preview.ts",
        site: "wide listing-surface gate (lines 167-168)",
        targets: ["src/app/api/business-os/blueprints/route.ts", "src/app/api/platform/blueprints/route.ts"],
        stripped: false,
        getPattern: null,
        writePattern: /\bexport\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/,
    },
    {
        consumer: "check-onboarding-blueprint-coverage.ts",
        site: "exportsBlueprintWriteRoute (line 171) - runs over EVERY api route file",
        targets: corpus.map((entry) => `src/app/api/${entry.rel}`),
        stripped: false,
        getPattern: null,
        writePattern: /\bexport\s+(?:(?:async\s+)?function|const|let|var)\s+(?:POST|PUT|PATCH|DELETE)\b/,
    },
    {
        consumer: "check-blueprint-install-routes.ts",
        site: "plan-route gate (lines 154-155)",
        targets: ["src/app/api/platform/workspaces/[workspaceId]/blueprint/plan/route.ts"],
        stripped: false,
        getPattern: /export\s+async\s+function\s+GET\b/,
        writePattern: /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/,
    },
    {
        consumer: "check-operations-routes.ts",
        site: "inline GET-only gate (line 124)",
        targets: ["src/app/api/platform/operations/today/route.ts"],
        stripped: false,
        getPattern: /export async function GET\(/,
        writePattern: /export async function (POST|PATCH|PUT|DELETE)\(/,
    },
    // Migrated in this phase (T2-A): check-workspace-surface-boundary.ts assertion 11, whose old inline
    // regexes ran over executableSource()-STRIPPED source. Both patterns are reproduced verbatim so this
    // file proves the migration moved no verdict on the one route that assertion reads.
    {
        consumer: "check-workspace-surface-boundary.ts",
        site: "assertion 11 - the route exports GET and no write verb (inline GET/write regex, was lines 327-335)",
        targets: ["src/app/api/platform/workspaces/[workspaceId]/surfaces/route.ts"],
        stripped: true,
        getPattern: /export\s+async\s+function\s+GET\b/,
        writePattern: /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/,
    },
])

for (const site of OLD_SITES) {
    const disagreements: string[] = []
    let compared = 0
    for (const target of site.targets) {
        const full = join(APP_ROOT, target)
        if (!existsSync(full)) {
            disagreements.push(`${target}: MISSING FILE`)
            continue
        }
        const raw = readFileSync(full, "utf8")
        const input = site.stripped ? executableLines(raw) : raw
        const classified = classifyRouteModule(full, raw)
        compared += 1

        const oldWrite = site.writePattern.test(input)
        const newWrite = !exportsNoStateChangingMethod(classified)
        if (oldWrite !== newWrite) {
            disagreements.push(`${target}: WRITE old=${oldWrite} new=${newWrite} (new sees [${classified.stateChanging.join(",")}])`)
        }
        if (site.getPattern !== null) {
            const oldGet = site.getPattern.test(input)
            const newGet = exportsMethod(classified, "GET")
            if (oldGet !== newGet) {
                disagreements.push(`${target}: GET old=${oldGet} new=${newGet}`)
            }
        }
    }
    checkInvertible(
        `EQUIVALENCE: ${site.consumer} - ${site.site} - old and new agree on every file it reads`,
        disagreements.length === 0 && compared === site.targets.length,
        disagreements.length > 0
            ? `VERDICT MOVED: ${disagreements.join(" | ")}`
            : `${compared} file(s) compared, identical verdicts`,
    )
}

// ---------------------------------------------------------------------------
// 4. Corpus-wide two-sided cross-check
// ---------------------------------------------------------------------------
/**
 * BOTH DIRECTIONS, and the second direction is the one that matters for trusting the AST.
 *
 * A regex hit the AST missed would mean the AST under-reported - a file that failed to parse, a shape not
 * handled - and that failure would otherwise present as a clean pass with fewer findings. So it is a
 * separate assertion, over comment-stripped source, so the only remaining differences would be real.
 */
const astMissedRegexFound: string[] = []
const astFoundRegexMissed: string[] = []
for (const { file, rel, src } of corpus) {
    const classified = classifyRouteModule(file, src)
    const stripped = executableLines(src)
    const regexWrite = WIDEST_OLD_STATE_CHANGING.test(stripped)
    const astWrite = !exportsNoStateChangingMethod(classified)
    if (regexWrite && !astWrite) astMissedRegexFound.push(rel)
    if (astWrite && !regexWrite) astFoundRegexMissed.push(`${rel} [${classified.stateChanging.join(",")}]`)
}
checkInvertible(
    "CROSS-CHECK: on comment-stripped source the AST finds a state-changing export on every file the widest regex does - the AST never under-reports",
    astMissedRegexFound.length === 0,
    astMissedRegexFound.length > 0
        ? `AST UNDER-REPORTED on: ${astMissedRegexFound.join(", ")}`
        : `${corpus.length} files, no regex hit unmatched by the AST`,
)
// The reverse direction is reported rather than forbidden: an AST-only hit would be a real shape the regex
// cannot express (a re-export, most likely), which is a finding for a reader and not a defect.
check(
    "CROSS-CHECK: any file where the AST sees a state-changing export and the widest regex does not is enumerated, not hidden",
    true,
    astFoundRegexMissed.length > 0 ? `AST-ONLY (expected: re-export shapes): ${astFoundRegexMissed.join(", ")}` : "none - AST and widest regex agree on all 154 files",
)

// ---------------------------------------------------------------------------
// 5. What the narrow patterns were missing, enumerated
// ---------------------------------------------------------------------------
const NARROW_GET = /export async function GET\(/
const NARROW_WRITE = /export async function (POST|PATCH|PUT|DELETE)\(/
const newlyCaughtGet: string[] = []
const newlyCaughtWrite: string[] = []
for (const { file, rel, src } of corpus) {
    const classified = classifyRouteModule(file, src)
    if (exportsMethod(classified, "GET") && !NARROW_GET.test(src)) newlyCaughtGet.push(rel)
    if (!exportsNoStateChangingMethod(classified) && !NARROW_WRITE.test(src)) {
        newlyCaughtWrite.push(`${rel} [${classified.stateChanging.join(",")}]`)
    }
}
checkInvertible(
    "MEASURED: the canonical classifier catches 28 GET-exporting route files the narrow `export async function GET(` pattern misses",
    newlyCaughtGet.length === 28,
    `${newlyCaughtGet.length} newly caught GET routes: ${newlyCaughtGet.slice(0, 6).join(", ")}${newlyCaughtGet.length > 6 ? ", ..." : ""}`,
)
checkInvertible(
    "MEASURED: the canonical classifier catches 21 route files that DO export a state-changing verb and which the narrow write pattern misses - this is the size of the hole in the no-write guarantee",
    newlyCaughtWrite.length === 21,
    `${newlyCaughtWrite.length} newly caught write routes: ${newlyCaughtWrite.slice(0, 5).join(", ")}${newlyCaughtWrite.length > 5 ? ", ..." : ""}`,
)

// ---------------------------------------------------------------------------
// 6. The two surfaces this wave's other task guards, asserted through the canonical classifier
// ---------------------------------------------------------------------------
for (const target of [
    "src/app/api/platform/operations/today/route.ts",
    "src/app/api/platform/operations/due-work/route.ts",
]) {
    const classified = classifyRouteModule(join(APP_ROOT, target), readFileSync(join(APP_ROOT, target), "utf8"))
    checkInvertible(
        `${target} exports GET, exports no state-changing verb, and leaves HEAD and OPTIONS to the framework`,
        exportsMethod(classified, "GET") && exportsNoStateChangingMethod(classified) && frameworkDerivesSafeMethods(classified),
        `methods=[${describeMethods(classified)}] styles=[${classified.exports.map((e) => `${e.method}:${e.style}@${e.line}`).join(" ")}]`,
    )
}

const failed = results.filter((r) => !r.pass)
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
console.log("")
console.log(`${results.length - failed.length}/${results.length} http method classifier assertions passed`)
if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
if (failed.length > 0) {
    console.error(`${failed.length} http method classifier assertion(s) FAILED`)
    process.exit(1)
}
console.log("One canonical HTTP method classifier, and every consumer's verdict is unchanged.")
