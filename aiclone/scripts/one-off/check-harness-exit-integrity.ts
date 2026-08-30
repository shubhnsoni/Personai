/**
 * check-harness-exit-integrity.ts - does a verdict that WAS computed actually reach the exit code?
 *
 * A harness can assert correctly and still report success, because the exit decision was taken
 * before the last assertion ran. `process.exitCode = failures.length === 0 ? 0 : 1` followed by more
 * `check(...)` calls freezes the verdict: those later assertions are computed, printed, and thrown
 * away. `check-assertion-vacuity.ts` answers the question underneath this one - can the condition be
 * false at all - and the two together are the controls the rest of the suite's credibility rests on.
 *
 * WHAT THIS FILE HAD TO FIX ABOUT ITSELF (Q2-A)
 *
 * It carried a hardcoded `ASSERTION_NAMES` set. Measured against the tree it was wrong in both
 * directions at once, so its "0 real defects across 74 harnesses" covered less than it read:
 *
 *   - `expect`, `mustAllow`, `mustRefuse`: ZERO callsites and ZERO declarations anywhere. Three of
 *     the seven names in the set matched nothing at all.
 *   - `refuses`: 102 callsites, but it is DECLARED NINE TIMES with two different meanings. In six
 *     files it is a probe - `async function refuses(tag, body): Promise<{refused, detail}>` - that
 *     records no verdict and merely returns one; counting those 102 calls as assertions inflated
 *     every assertions-after count in six harnesses. In three files it genuinely wraps `check`.
 *     One global name cannot be right for both, which is why the set is now derived PER FILE.
 *   - `assert` in `check-foundation-contracts.ts` records its verdict with `failures += 1`. The
 *     old set caught it by name; naive discovery would have MISSED it, because a compound
 *     assignment is not an `=`. `recordsVerdict` now accepts `+=` and `++` for that reason.
 *   - the whole `refusesBy` / `accepts` / `protectedCase` / `expectThrow` / `expectOrder` family -
 *     local functions that each emit exactly one assertion - was invisible. A call to one of them
 *     sitting after an exit decision was not counted as an assertion at all.
 *
 * SO: the helper set is now DISCOVERED FROM SOURCE, per file, and aliases and single-level local
 * wrappers are followed. What can and cannot be followed is printed on every run - see
 * `FOLLOWED` / `NOT_FOLLOWED` below - because an unfollowed wrapper is a silent hole, and a silent
 * hole in a control is worse than a declared one.
 *
 * INVENTORY. The file list comes from `scripts/gates/gates.manifest.json`, the same declared
 * inventory `scripts/gates/run-gates.js` uses, reconciled against the directory on every run. A
 * harness in one and not the other is a hard failure, not a quieter scan: the two must not be able
 * to disagree about what exists.
 *
 * FLAGS
 *   (none)            scan every harness the manifest declares; exit 1 on a real defect
 *   --self-test       run the controlled fixture suite: one fixture per scanner class, each of
 *                     which must be classified exactly as declared
 *   --prove-failure   append the frozen-verdict fixture to the findings, so a clean tree exits 1
 *   --quiet           print only the counts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

type Classification =
    | "REAL_DEFECT"
    | "INTENTIONAL_GUARD"
    | "FINAL_VERDICT"
    | "PRELIMINARY_SUMMARY_RECOMPUTED"

type Finding = {
    file: string
    line: number
    shape: string
    assertionsAfter: number
    classification: Classification
    evidence: string
}

/** An inventory or coverage problem. Distinct from a Finding: it voids the scan rather than failing a harness. */
type IntegrityFinding = { kind: string; detail: string }

/**
 * Harnesses that legitimately declare NO assertion helper, so this scanner cannot judge their exit
 * integrity and must not pretend otherwise.
 *
 * This list is the point. "0 recognised assertions" is reported for every harness it happens to, but
 * it GATES only when the set changes - a harness dropping off this list has become judgeable, and a
 * new one appearing has silently stopped being judged. Gating on the list being empty would make this
 * scanner red on arrival, which turns a control into a disabled one; not gating at all would let the
 * hole grow quietly. So the exception is named, and the CHANGE is what fails.
 */
const NO_HELPER_BY_DESIGN: ReadonlyMap<string, string> = new Map([
    ["check-assertion-vacuity.ts", "A source scanner, not a behavioural harness. It reports through console.log and one `process.exitCode` at the end, with no assertion helper of its own; its own controls are its `--self-test` fixtures. Its exit shape is still checked here - it simply contributes no assertion calls."],
])

const SELF_NAME = "check-harness-exit-integrity.ts"
const MANIFEST_PATH = join(__dirname, "..", "gates", "gates.manifest.json")

/**
 * Names the old hardcoded set carried that match NOTHING in this tree, kept only as a classification
 * so their removal is a recorded decision rather than a silent deletion. Each is VERIFIED absent on
 * every run: if one ever gains a callsite, the scan fails with CLASSIFIED_NAME_REAPPEARED, because at
 * that point this comment is the stale thing.
 */
const CLASSIFIED_ABSENT: ReadonlyMap<string, string> = new Map([
    ["expect", "0 callsites, 0 declarations. A Jest/Vitest-style name; no harness in this tree uses a test framework. Removed rather than kept as decoration."],
    ["mustAllow", "0 callsites, 0 declarations. Never existed here; authz harnesses use `check`/`checkInvertible` with a named case instead."],
    ["mustRefuse", "0 callsites, 0 declarations. Same as mustAllow. The refusal helpers that DO exist are named `refuses`/`refusesBy` and are discovered from source."],
])

/**
 * A name previously hardcoded that IS present but is not globally an assertion. Recorded so the
 * per-file derivation is visibly deliberate: `refuses` is a probe in six harnesses and a wrapper in
 * three, and the report prints which is which.
 */
const CLASSIFIED_AMBIGUOUS: ReadonlyMap<string, string> = new Map([
    ["refuses", "Declared 9 times with two meanings: a probe returning {refused, detail} (records nothing) and a wrapper around check/checkInvertible (records one verdict). Derived per file; never assumed."],
])

/** Parameter names this repository uses for "the thing that must be true". */
const CONDITION_PARAMETERS = new Set(["condition", "pass", "passed", "ok", "holds", "observed", "expectation", "truth"])

/** Targets whose mutation is a recorded verdict. */
const VERDICT_TARGET = /result|failure|assertion|coverage|verdict|defect|problem/iu

/** Every operator that WRITES to its left operand. `failures += 1` must count, not only `x = y`. */
const ASSIGNMENT_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
])

/** What the coverage layer follows, printed on every run so the boundary is not folklore. */
const FOLLOWED: readonly string[] = [
    "a helper DECLARED in the harness with a condition-shaped parameter that records a verdict (throw, .push, or any assignment/increment of a verdict-shaped name)",
    "a helper declared in ANY other harness, applied to a file that does not declare that name itself",
    "a direct identifier alias, `const ok = checkInvertible`, transitively up to 4 links",
    "a local wrapper with at least one parameter whose body calls a helper, to a nesting depth of 2 wrappers",
    "a member call, `suite.check(...)`, matched on the method name",
]

const NOT_FOLLOWED: readonly string[] = [
    "a helper reached only through a value: passed as a callback, stored in an object or array, or selected by index or computed key",
    "a wrapper more than 2 levels above a real helper",
    "a zero-argument function that asserts - `main()`, `unavailableHarness()` - deliberately, because it is a driver or a whole-harness fallback, not a per-case assertion, and counting its call as one assertion would understate it rather than overstate it",
    "a helper imported from another module: `import` bindings are not resolved, so a shared helper file would be invisible (none exists in this tree today - every harness declares its own)",
    "re-export or namespace indirection of any kind",
]

function lineOf(source: ts.SourceFile, node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function walk(node: ts.Node, visitor: (candidate: ts.Node) => void): void {
    visitor(node)
    ts.forEachChild(node, (child) => walk(child, visitor))
}

function contains(node: ts.Node, predicate: (candidate: ts.Node) => boolean): boolean {
    let found = false
    walk(node, (candidate) => {
        if (predicate(candidate)) found = true
    })
    return found
}

function propertyName(node: ts.Expression): string | null {
    return ts.isPropertyAccessExpression(node) ? node.name.text : null
}

// ---------------------------------------------------------------------------------------------
// helper discovery
// ---------------------------------------------------------------------------------------------

type FunctionLike = Readonly<{
    name: string
    parameters: ts.NodeArray<ts.ParameterDeclaration>
    body: ts.Node | undefined
}>

/** Every named function-like declaration in the file: `function f`, `const f = () =>`, `const f = function`. */
function functionsOf(source: ts.SourceFile): FunctionLike[] {
    const functions: FunctionLike[] = []
    walk(source, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name && node.body) {
            functions.push({ name: node.name.text, parameters: node.parameters, body: node.body })
            return
        }
        if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
            functions.push({
                name: node.name.text,
                parameters: node.initializer.parameters,
                body: node.initializer.body,
            })
        }
    })
    return functions
}

/**
 * Does this body RECORD a verdict, rather than merely return one?
 *
 * The compound-assignment and increment arms are not decoration: `check-foundation-contracts.ts`
 * records with `failures += 1`, and `check-order-stream.ts` with a `throw`. Requiring a plain `=`
 * would have silently dropped a real helper and left that harness scanned with no helper at all.
 */
function recordsVerdict(body: ts.Node | undefined): boolean {
    if (!body) return false
    return contains(body, (candidate) => {
        if (ts.isThrowStatement(candidate)) return true
        if (
            ts.isCallExpression(candidate)
            && ts.isPropertyAccessExpression(candidate.expression)
            && candidate.expression.name.text === "push"
        ) return true
        if (ts.isBinaryExpression(candidate) && ASSIGNMENT_OPERATORS.has(candidate.operatorToken.kind)) {
            return VERDICT_TARGET.test(candidate.left.getText())
        }
        if (
            (ts.isPostfixUnaryExpression(candidate) || ts.isPrefixUnaryExpression(candidate))
            && (candidate.operator === ts.SyntaxKind.PlusPlusToken || candidate.operator === ts.SyntaxKind.MinusMinusToken)
        ) return VERDICT_TARGET.test(candidate.operand.getText())
        return false
    })
}

/** Does this signature carry a "the thing that must be true" parameter? */
function hasConditionParameter(parameters: ts.NodeArray<ts.ParameterDeclaration>): boolean {
    return parameters.some((parameter) => {
        if (!ts.isIdentifier(parameter.name)) return false
        if (!CONDITION_PARAMETERS.has(parameter.name.text)) return false
        const kind = parameter.type?.kind
        return kind === ts.SyntaxKind.BooleanKeyword
            || kind === ts.SyntaxKind.UnknownKeyword
            || kind === undefined
    })
}

type Discovery = Readonly<{
    /** Names this file declares that are real assertion helpers. */
    base: ReadonlySet<string>
    /** Every function-like name this file declares, so an inherited name can be overridden. */
    declared: ReadonlySet<string>
    functions: readonly FunctionLike[]
}>

function discoverBase(source: ts.SourceFile): Discovery {
    const functions = functionsOf(source)
    const base = new Set<string>()
    const declared = new Set<string>()
    for (const candidate of functions) {
        declared.add(candidate.name)
        if (hasConditionParameter(candidate.parameters) && recordsVerdict(candidate.body)) base.add(candidate.name)
    }
    return { base, declared, functions }
}

type Effective = Readonly<{
    names: ReadonlySet<string>
    aliases: readonly string[]
    wrappers: readonly string[]
    inherited: readonly string[]
    /** Locally declared names that share a name with a helper elsewhere but record nothing here. */
    overridden: readonly string[]
}>

/**
 * The effective assertion-name set for ONE file.
 *
 * Per-file declarations win. A name declared in this file and found not to record a verdict is NOT
 * inherited from elsewhere - that is exactly the `refuses` case, and it is the whole reason a global
 * hardcoded set could not be right.
 */
function effectiveNames(source: ts.SourceFile, discovery: Discovery, elsewhere: ReadonlySet<string>): Effective {
    const names = new Set(discovery.base)
    const inherited: string[] = []
    const overridden: string[] = []
    for (const name of elsewhere) {
        if (discovery.declared.has(name)) {
            if (!discovery.base.has(name)) overridden.push(name)
            continue
        }
        names.add(name)
        inherited.push(name)
    }

    // direct aliases, transitively, bounded
    const aliases: string[] = []
    for (let pass = 0; pass < 4; pass += 1) {
        let grew = false
        walk(source, (node) => {
            if (
                ts.isVariableDeclaration(node)
                && ts.isIdentifier(node.name)
                && node.initializer
                && ts.isIdentifier(node.initializer)
                && names.has(node.initializer.text)
                && !names.has(node.name.text)
            ) {
                names.add(node.name.text)
                aliases.push(`${node.name.text} = ${node.initializer.text}`)
                grew = true
            }
        })
        if (!grew) break
    }

    // single-level local wrappers, then wrappers of wrappers, capped at depth 2
    const wrappers: string[] = []
    for (let depth = 0; depth < 2; depth += 1) {
        let grew = false
        for (const candidate of discovery.functions) {
            if (names.has(candidate.name) || !candidate.body) continue
            // A zero-argument asserting function is a driver (`main`), not a per-case helper.
            if (candidate.parameters.length === 0) continue
            const calls = contains(candidate.body, (node) =>
                ts.isCallExpression(node)
                && ((ts.isIdentifier(node.expression) && names.has(node.expression.text))
                    || (ts.isPropertyAccessExpression(node.expression) && names.has(node.expression.name.text))))
            if (!calls) continue
            names.add(candidate.name)
            wrappers.push(`${candidate.name} (depth ${depth + 1})`)
            grew = true
        }
        if (!grew) break
    }

    return { names, aliases, wrappers, inherited, overridden }
}

// ---------------------------------------------------------------------------------------------
// exit / verdict shapes
// ---------------------------------------------------------------------------------------------

function isProcessExit(node: ts.Node): boolean {
    return ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === "process"
        && node.expression.name.text === "exit"
}

function isProcessExitCodeAssignment(node: ts.Node): boolean {
    return ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(node.left)
        && ts.isIdentifier(node.left.expression)
        && node.left.expression.text === "process"
        && node.left.name.text === "exitCode"
}

function isVerdictAssignment(node: ts.Node): boolean {
    return ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (propertyName(node.left) === "result" || propertyName(node.left) === "failures")
}

function isAssertion(node: ts.Node, names: ReadonlySet<string>): boolean {
    if (!ts.isCallExpression(node)) return false
    if (ts.isIdentifier(node.expression)) return names.has(node.expression.text)
    return ts.isPropertyAccessExpression(node.expression) && names.has(node.expression.name.text)
}

function executionScope(node: ts.Node): ts.Node {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) current = current.parent
    return current ?? node.getSourceFile()
}

function safetyGuardCondition(node: ts.Node, source: ts.SourceFile): string | null {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
        if (ts.isIfStatement(current)) {
            const condition = current.expression.getText(source)
            if (/AUTHORIZED_TARGET|DISPOSABLE|database|\.db\b/u.test(condition)) return condition
        }
        current = current.parent
    }
    return null
}

function hasConditionalAncestor(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
        if (ts.isIfStatement(current) || ts.isConditionalExpression(current) || ts.isCatchClause(current)) return true
        current = current.parent
    }
    return false
}

// ---------------------------------------------------------------------------------------------
// the scan
// ---------------------------------------------------------------------------------------------

type ScanResult = Readonly<{
    findings: readonly Finding[]
    assertionCount: number
    effective: Effective
    helperNames: readonly string[]
}>

function analyze(file: string, text: string, elsewhere: ReadonlySet<string>): ScanResult {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const discovery = discoverBase(source)
    const effective = effectiveNames(source, discovery, elsewhere)
    const names = effective.names

    const assertions: ts.Node[] = []
    const exits: ts.Node[] = []
    const summaries: ts.Node[] = []

    walk(source, (node) => {
        if (isAssertion(node, names)) assertions.push(node)
        if (isProcessExit(node) || isProcessExitCodeAssignment(node)) exits.push(node)
        if (isVerdictAssignment(node)) summaries.push(node)
    })

    const findings: Finding[] = []
    for (const decision of exits) {
        const scope = executionScope(decision)
        const decisionLine = lineOf(source, decision)
        const scopeAssertions = assertions.filter((assertion) => executionScope(assertion) === scope)
        const after = scopeAssertions.filter((assertion) => assertion.getStart(source) > decision.getStart(source))
        const before = scopeAssertions.filter((assertion) => assertion.getStart(source) < decision.getStart(source))
        const shape = isProcessExit(decision) ? "process.exit()" : "process.exitCode assignment"

        if (after.length === 0) {
            findings.push({
                file,
                line: decisionLine,
                shape,
                assertionsAfter: 0,
                classification: "FINAL_VERDICT",
                evidence: "No assertion call remains in this execution scope after the decision.",
            })
            continue
        }

        const safetyCondition = safetyGuardCondition(decision, source)
        if (safetyCondition || (before.length === 0 && hasConditionalAncestor(decision))) {
            findings.push({
                file,
                line: decisionLine,
                shape,
                assertionsAfter: after.length,
                classification: "INTENTIONAL_GUARD",
                evidence: safetyCondition
                    ? `Conditional disposable-target safety guard (${safetyCondition}) aborts before unsafe database work; it does not freeze an assertion verdict.`
                    : "Conditional exit occurs before the first assertion in its execution scope; this is a precondition guard, not a frozen assertion verdict.",
            })
            continue
        }

        findings.push({
            file,
            line: decisionLine,
            shape,
            assertionsAfter: after.length,
            classification: "REAL_DEFECT",
            evidence: `${before.length} assertion call(s) precede and ${after.length} assertion call(s) follow this exit decision in the same execution scope.`,
        })
    }

    for (const summary of summaries) {
        const scope = executionScope(summary)
        const laterAssertions = assertions.filter(
            (assertion) => executionScope(assertion) === scope && assertion.getStart(source) > summary.getStart(source),
        )
        if (laterAssertions.length === 0) continue
        const name = propertyName((summary as ts.BinaryExpression).left)
        const recomputed = summaries.some(
            (later) => later !== summary
                && executionScope(later) === scope
                && later.getStart(source) > laterAssertions[laterAssertions.length - 1].getStart(source)
                && propertyName((later as ts.BinaryExpression).left) === name,
        )
        findings.push({
            file,
            line: lineOf(source, summary),
            shape: `summary ${name ?? "assignment"}`,
            assertionsAfter: laterAssertions.length,
            classification: recomputed ? "PRELIMINARY_SUMMARY_RECOMPUTED" : "REAL_DEFECT",
            evidence: recomputed
                ? "The summary field is reassigned after the later assertions, before the final output/exit decision."
                : "A summary field is computed before later assertions and is not recomputed afterward.",
        })
    }

    return { findings, assertionCount: assertions.length, effective, helperNames: [...names].sort() }
}

function printFinding(finding: Finding): void {
    console.log(
        `${finding.classification} ${finding.file}:${finding.line} ${finding.shape}; assertions-after=${finding.assertionsAfter}; ${finding.evidence}`,
    )
}

// ---------------------------------------------------------------------------------------------
// inventory, from the gate driver's manifest
// ---------------------------------------------------------------------------------------------

type Manifest = Readonly<{
    harnesses: ReadonlyArray<{ file: string; package?: string; run?: boolean }>
    harnessPattern?: string
}>

type Inventory = Readonly<{ files: readonly string[]; integrity: IntegrityFinding[]; source: string }>

/**
 * The pure reconciliation, separated from the file system so `--self-test` can drive it with
 * synthetic inventories and prove each finding kind actually fires.
 */
function reconcile(declared: readonly string[], onDisk: readonly string[]): IntegrityFinding[] {
    const integrity: IntegrityFinding[] = []
    const declaredSorted = [...declared].sort()
    const declaredSet = new Set(declaredSorted)
    const diskSet = new Set(onDisk)

    for (const file of declaredSorted) {
        if (!diskSet.has(file)) {
            integrity.push({
                kind: "MANIFEST_ENTRY_MISSING_ON_DISK",
                detail: `gates.manifest.json declares ${file}, which is not on disk. The manifest and the tree disagree; run-gates.js would raise the same thing.`,
            })
        }
    }
    for (const file of onDisk) {
        if (!declaredSet.has(file)) {
            integrity.push({
                kind: "ON_DISK_NOT_IN_MANIFEST",
                detail: `${file} exists but gates.manifest.json does not declare it, so the gate sweep would not run it and this scan would silently cover a different set. Add a manifest entry.`,
            })
        }
    }
    const duplicates = declaredSorted.filter((file, index) => index > 0 && declaredSorted[index - 1] === file)
    for (const file of new Set(duplicates)) {
        integrity.push({
            kind: "DUPLICATE_MANIFEST_ENTRY",
            detail: `${file} is declared more than once in gates.manifest.json.`,
        })
    }
    return integrity
}

/**
 * The file list, from the manifest, reconciled against disk.
 *
 * A bare `readdirSync` cannot disagree with itself, which sounds like a virtue and is not: it means
 * this scanner and `run-gates.js` could silently be looking at different sets. Taking the manifest as
 * the inventory and failing on any mismatch makes that impossible.
 */
function inventory(): Inventory {
    const onDisk = readdirSync(__dirname).filter((file) => /^check-.*\.ts$/u.test(file)).sort()

    if (!existsSync(MANIFEST_PATH)) {
        return {
            files: onDisk.filter((file) => file !== SELF_NAME),
            integrity: [{
                kind: "MANIFEST_UNREADABLE",
                detail: `${MANIFEST_PATH} does not exist. Falling back to a directory listing means this scanner and run-gates.js can disagree about what exists, so the scan is reported as void.`,
            }],
            source: "readdir (manifest missing)",
        }
    }

    let manifest: Manifest
    try {
        manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest
    } catch (error) {
        return {
            files: onDisk.filter((file) => file !== SELF_NAME),
            integrity: [{
                kind: "MANIFEST_UNREADABLE",
                detail: `${MANIFEST_PATH} did not parse: ${error instanceof Error ? error.message : String(error)}`,
            }],
            source: "readdir (manifest unparseable)",
        }
    }

    const declared = manifest.harnesses.map((entry) => entry.file).sort()
    const diskSet = new Set(onDisk)
    // Scan the intersection, so a mismatch is loud but still produces a usable report.
    return {
        files: declared.filter((file) => diskSet.has(file) && file !== SELF_NAME),
        integrity: reconcile(declared, onDisk),
        source: "scripts/gates/gates.manifest.json",
    }
}

// ---------------------------------------------------------------------------------------------
// controlled fixtures - one per scanner class, each mutated in the self-test to prove it turns red
// ---------------------------------------------------------------------------------------------

type Fixture = Readonly<{
    name: string
    covers: string
    expect: Classification | "NO_FINDING"
    source: string
}>

const FIXTURES: readonly Fixture[] = [
    {
        name: "frozen-verdict",
        covers: "REAL_DEFECT (exit form): assertions both before and after the exit decision",
        expect: "REAL_DEFECT",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "check('before', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "check('late assertion', false)",
        ].join("\n"),
    },
    {
        name: "final-verdict",
        covers: "FINAL_VERDICT: the healthy shape - nothing asserts after the decision",
        expect: "FINAL_VERDICT",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "check('first', true)",
            "check('second', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
        ].join("\n"),
    },
    {
        name: "intentional-guard",
        covers: "INTENTIONAL_GUARD: a disposable-target precondition exit, with assertions after it",
        expect: "INTENTIONAL_GUARD",
        source: [
            "const failures: string[] = []",
            "declare const db: string",
            "declare const AUTHORIZED_TARGET: string",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "if (db !== AUTHORIZED_TARGET) { process.exit(2) }",
            "check('runs only against the disposable target', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
        ].join("\n"),
    },
    {
        name: "summary-recomputed",
        covers: "PRELIMINARY_SUMMARY_RECOMPUTED: an early summary that IS recomputed after later assertions",
        expect: "PRELIMINARY_SUMMARY_RECOMPUTED",
        source: [
            "const failures: string[] = []",
            "const report: { result: string; failures: number } = { result: '', failures: 0 }",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "check('early', true)",
            "report.result = failures.length === 0 ? 'ok' : 'fail'",
            "check('later', true)",
            "report.result = failures.length === 0 ? 'ok' : 'fail'",
            "process.exitCode = failures.length === 0 ? 0 : 1",
        ].join("\n"),
    },
    {
        name: "summary-frozen",
        covers: "REAL_DEFECT (summary form): an early summary never recomputed after later assertions",
        expect: "REAL_DEFECT",
        source: [
            "const failures: string[] = []",
            "const report: { result: string } = { result: '' }",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "check('early', true)",
            "report.result = failures.length === 0 ? 'ok' : 'fail'",
            "check('later', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
        ].join("\n"),
    },
    {
        name: "alias-followed",
        covers: "ALIAS following: `const ok = check` - the frozen verdict is only visible if the alias is resolved",
        expect: "REAL_DEFECT",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "const ok = check",
            "ok('before', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "ok('late assertion behind an alias', false)",
        ].join("\n"),
    },
    {
        name: "wrapper-followed",
        covers: "WRAPPER following (depth 1): a local function that computes its own condition and asserts",
        expect: "REAL_DEFECT",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "function refusesBy(name: string, pattern: RegExp, raw: string) { check(name, pattern.test(raw)) }",
            "refusesBy('before', /x/u, 'x')",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "refusesBy('late assertion behind a wrapper', /y/u, 'x')",
        ].join("\n"),
    },
    {
        name: "wrapper-depth-2",
        covers: "WRAPPER following (depth 2): a wrapper of a wrapper, the declared limit of what is followed",
        expect: "REAL_DEFECT",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "// `refusesByCode` is declared BEFORE the wrapper it wraps, on purpose: on the first pass",
            "// `refusesBy` is not yet a known helper, so only the second pass can register this one. That",
            "// makes the fixture actually depend on depth 2 rather than on a lucky declaration order.",
            "function refusesByCode(name: string, code: string) { refusesBy(name, new RegExp(code, 'u'), 'x') }",
            "function refusesBy(name: string, pattern: RegExp, raw: string) { check(name, pattern.test(raw)) }",
            "refusesByCode('before', 'x')",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "refusesByCode('late assertion two wrappers deep', 'y')",
        ].join("\n"),
    },
    {
        name: "compound-assignment-helper",
        covers: "DISCOVERY of a helper that records with `failures += 1` rather than an `=` or a .push",
        expect: "REAL_DEFECT",
        source: [
            "let failures = 0",
            "function assert(condition: unknown, message: string): void { if (!condition) { failures += 1; console.error(message) } }",
            "assert(true, 'before')",
            "process.exitCode = failures === 0 ? 0 : 1",
            "assert(false, 'late assertion after the decision')",
        ].join("\n"),
    },
    {
        name: "probe-not-an-assertion",
        covers: "NEGATIVE control: a `refuses` PROBE that records nothing must not be counted as an assertion",
        expect: "NO_FINDING",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "async function refuses(tag: string): Promise<{ refused: boolean; detail: string }> {",
            "    return { refused: tag.length > 0, detail: tag }",
            "}",
            "check('before', true)",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "void refuses('after the decision, but it asserts nothing')",
        ].join("\n"),
    },
    {
        name: "zero-argument-driver",
        covers: "NEGATIVE control: a zero-argument asserting function (`main`) is a driver, not a helper",
        expect: "NO_FINDING",
        source: [
            "const failures: string[] = []",
            "function check(_name: string, condition: boolean) { if (!condition) failures.push(_name) }",
            "async function main() { check('inside the driver', true) }",
            "void main()",
            "process.exitCode = failures.length === 0 ? 0 : 1",
            "void main()",
        ].join("\n"),
    },
]

/** The one used by --prove-failure, so a clean tree can still be shown to exit 1. */
const PROVE_FAILURE_FIXTURE = FIXTURES[0]

/** Inventory fixtures: synthetic manifest/disk pairs, one per reconciliation finding kind. */
const INVENTORY_FIXTURES: ReadonlyArray<Readonly<{
    name: string
    covers: string
    declared: readonly string[]
    onDisk: readonly string[]
    expect: string | null
}>> = [
    {
        name: "inventory-agreeing",
        covers: "NEGATIVE control: manifest and disk agree, so nothing fires",
        declared: ["check-a.ts", "check-b.ts"],
        onDisk: ["check-a.ts", "check-b.ts"],
        expect: null,
    },
    {
        name: "inventory-manifest-entry-missing",
        covers: "MANIFEST_ENTRY_MISSING_ON_DISK: the manifest declares a harness that is not there",
        declared: ["check-a.ts", "check-gone.ts"],
        onDisk: ["check-a.ts"],
        expect: "MANIFEST_ENTRY_MISSING_ON_DISK",
    },
    {
        name: "inventory-on-disk-undeclared",
        covers: "ON_DISK_NOT_IN_MANIFEST: a harness exists that the gate sweep would never run",
        declared: ["check-a.ts"],
        onDisk: ["check-a.ts", "check-new.ts"],
        expect: "ON_DISK_NOT_IN_MANIFEST",
    },
    {
        name: "inventory-duplicate-entry",
        covers: "DUPLICATE_MANIFEST_ENTRY: the same harness declared twice",
        declared: ["check-a.ts", "check-a.ts"],
        onDisk: ["check-a.ts"],
        expect: "DUPLICATE_MANIFEST_ENTRY",
    },
]

function runSelfTest(elsewhere: ReadonlySet<string>): boolean {
    let ok = true
    for (const fixture of FIXTURES) {
        const result = analyze(`fixture-${fixture.name}.ts`, fixture.source, elsewhere)
        const interesting = result.findings.filter((finding) => finding.classification !== "FINAL_VERDICT")

        if (fixture.expect === "NO_FINDING") {
            if (interesting.length > 0) {
                console.error(
                    `FAIL self-test ${fixture.name}: expected no finding, saw ${interesting.map((f) => `${f.classification}@${f.line}`).join(", ")}`,
                )
                ok = false
                continue
            }
            console.log(`PASS self-test ${fixture.name}: nothing flagged, as required (${fixture.covers})`)
            continue
        }

        const hit = result.findings.find((finding) => finding.classification === fixture.expect)
        if (!hit) {
            const saw = result.findings.map((finding) => `${finding.classification}@${finding.line}`).join(", ") || "nothing"
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${saw}`)
            ok = false
            continue
        }
        console.log(
            `PASS self-test ${fixture.name}: ${fixture.expect} at fixture line ${hit.line}, assertions-after=${hit.assertionsAfter} (${fixture.covers})`,
        )
    }

    for (const fixture of INVENTORY_FIXTURES) {
        const found = reconcile(fixture.declared, fixture.onDisk)
        if (fixture.expect === null) {
            if (found.length > 0) {
                console.error(`FAIL self-test ${fixture.name}: expected no finding, saw ${found.map((f) => f.kind).join(", ")}`)
                ok = false
                continue
            }
            console.log(`PASS self-test ${fixture.name}: nothing flagged, as required (${fixture.covers})`)
            continue
        }
        if (!found.some((finding) => finding.kind === fixture.expect)) {
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${found.map((f) => f.kind).join(", ") || "nothing"}`)
            ok = false
            continue
        }
        console.log(`PASS self-test ${fixture.name}: ${fixture.expect} (${fixture.covers})`)
    }

    // The classified-absent names must still be absent from the fixture suite's own vocabulary, so
    // this file cannot quietly reintroduce one as a fixture and call it covered.
    for (const [name] of CLASSIFIED_ABSENT) {
        if (FIXTURES.some((fixture) => new RegExp(`\\b${name}\\s*\\(`, "u").test(fixture.source))) {
            console.error(`FAIL self-test: fixture suite uses the classified-absent name \`${name}\``)
            ok = false
        }
    }
    return ok
}

// ---------------------------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2)
const quiet = argv.includes("--quiet")
const proveFailure = argv.includes("--prove-failure")

const { files, integrity, source: inventorySource } = inventory()
const texts = new Map<string, string>()
for (const file of files) texts.set(file, readFileSync(join(__dirname, file), "utf8"))

// Pass 1: which names are real assertion helpers ANYWHERE, so a file that does not declare its own
// still gets covered. Self included: this file declares no helper, but a future edit might.
const elsewhere = new Set<string>()
const perFileBase = new Map<string, ReadonlySet<string>>()
for (const [file, text] of texts) {
    const discovery = discoverBase(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true))
    perFileBase.set(file, discovery.base)
    for (const name of discovery.base) elsewhere.add(name)
}

// Pass 2: the real scan.
const results = files.map((file) => analyze(file, texts.get(file) as string, elsewhere))
const findings = results.flatMap((result) => result.findings)
if (proveFailure) {
    findings.push(...analyze(`controlled-${PROVE_FAILURE_FIXTURE.name}.ts`, PROVE_FAILURE_FIXTURE.source, elsewhere).findings)
}

// A classified-absent name that turned up with callsites means this file's own classification is now
// the stale thing. Fail loudly rather than let the comment rot.
for (const [name, reason] of CLASSIFIED_ABSENT) {
    const callers: string[] = []
    for (const [file, text] of texts) {
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
        let seen = false
        walk(source, (node) => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) seen = true
        })
        if (seen) callers.push(file)
    }
    if (callers.length > 0) {
        integrity.push({
            kind: "CLASSIFIED_NAME_REAPPEARED",
            detail: `\`${name}\` was classified as absent ("${reason}") but now has callsites in ${callers.join(", ")}. Either it is a real helper - in which case discovery should find it and the classification must be deleted - or those callsites are something else and the classification needs rewording.`,
        })
    }
}

// A harness for which NO assertion helper could be found is a silent coverage hole: it would be
// reported as clean because nothing in it was recognised as an assertion at all. The set of such
// harnesses is declared above; a CHANGE to that set is what fails, not its non-emptiness.
const unjudgeable: string[] = []
for (let index = 0; index < files.length; index += 1) {
    if (results[index].assertionCount === 0) unjudgeable.push(files[index])
}
const coverageNotes: IntegrityFinding[] = []
for (const file of unjudgeable) {
    const reason = NO_HELPER_BY_DESIGN.get(file)
    if (reason) {
        coverageNotes.push({
            kind: "NO_ASSERTION_RECOGNISED_BY_DESIGN",
            detail: `${file}: ${reason}`,
        })
        continue
    }
    integrity.push({
        kind: "NO_ASSERTION_RECOGNISED",
        detail: `${file} yielded 0 recognised assertion calls with the derived helper set. Its exit integrity cannot be judged, so its silence is not evidence, and it is not on the declared NO_HELPER_BY_DESIGN list. Either the harness asserts through a shape discovery does not recognise - which is a hole in THIS file - or it genuinely asserts nothing.`,
    })
}
for (const [file, reason] of NO_HELPER_BY_DESIGN) {
    if (!files.includes(file)) continue
    if (unjudgeable.includes(file)) continue
    integrity.push({
        kind: "NO_HELPER_DECLARATION_STALE",
        detail: `${file} is declared as having no assertion helper ("${reason}") but ${results[files.indexOf(file)].assertionCount} assertion call(s) were recognised in it. The declaration is now the stale thing; delete the entry.`,
    })
}

const defects = findings.filter((finding) => finding.classification === "REAL_DEFECT")
const guards = findings.filter((finding) => finding.classification === "INTENTIONAL_GUARD")
const preliminary = findings.filter((finding) => finding.classification === "PRELIMINARY_SUMMARY_RECOMPUTED")
const finals = findings.filter((finding) => finding.classification === "FINAL_VERDICT")

if (!quiet) {
    for (const finding of findings.filter((finding) => finding.classification !== "FINAL_VERDICT")) printFinding(finding)
}

// ---- coverage report: what the helper set is, and how it was arrived at -------------------------

const allNames = [...new Set(results.flatMap((result) => result.helperNames))].sort()
const baseNames = [...elsewhere].sort()
const aliasNotes = results.flatMap((result) => result.effective.aliases.map((alias) => alias))
const wrapperNotes = new Map<string, number>()
for (const result of results) {
    for (const wrapper of result.effective.wrappers) wrapperNotes.set(wrapper, (wrapperNotes.get(wrapper) ?? 0) + 1)
}
const overridden = new Map<string, string[]>()
for (let index = 0; index < files.length; index += 1) {
    for (const name of results[index].effective.overridden) {
        overridden.set(name, [...(overridden.get(name) ?? []), files[index]])
    }
}

console.log(`Inventory source: ${inventorySource}. Scanned ${files.length} check harnesses, excluding ${SELF_NAME}.`)
console.log(`Assertion helpers DISCOVERED from source (declared with a condition parameter and recording a verdict): ${baseNames.join(", ")}.`)
console.log(`Effective set after aliases and wrappers: ${allNames.join(", ")}.`)
console.log(`Assertion calls recognised: ${results.reduce((sum, result) => sum + result.assertionCount, 0)}.`)
console.log(`Aliases followed: ${aliasNotes.length > 0 ? aliasNotes.join("; ") : "none present in this tree"}.`)
console.log(
    `Wrappers followed: ${wrapperNotes.size > 0 ? [...wrapperNotes].sort().map(([name, count]) => `${name} x${count} file(s)`).join("; ") : "none"}.`,
)
for (const [name, reason] of CLASSIFIED_AMBIGUOUS) {
    const where = overridden.get(name) ?? []
    console.log(
        `Name \`${name}\` is derived per file, not assumed: ${reason} Declared-but-not-recording in ${where.length} file(s)${where.length > 0 ? `: ${where.join(", ")}` : ""}.`,
    )
}
for (const [name, reason] of CLASSIFIED_ABSENT) console.log(`Removed from the old hardcoded set - \`${name}\`: ${reason}`)
console.log(`Coverage FOLLOWS: ${FOLLOWED.map((item, index) => `(${index + 1}) ${item}`).join(" ")}`)
console.log(`Coverage does NOT follow: ${NOT_FOLLOWED.map((item, index) => `(${index + 1}) ${item}`).join(" ")}`)

console.log(
    `Candidates: ${findings.length}; final verdicts: ${finals.length}; intentional guards: ${guards.length}; recomputed summaries: ${preliminary.length}; real defects: ${defects.length}.`,
)

for (const problem of coverageNotes) console.log(`COVERAGE ${problem.kind}: ${problem.detail}`)
for (const problem of integrity) console.log(`INTEGRITY ${problem.kind}: ${problem.detail}`)
console.log(
    `Coverage notes (declared, non-gating): ${coverageNotes.length}. Inventory/coverage integrity findings (gating): ${integrity.length}.`,
)

const selfTestOk = argv.includes("--self-test") ? runSelfTest(elsewhere) : true
if (defects.length > 0 || integrity.length > 0 || !selfTestOk) process.exitCode = 1
