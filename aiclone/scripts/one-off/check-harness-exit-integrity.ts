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
 * SO: the helper set is now DISCOVERED FROM SOURCE, per file, and aliases and local wrappers are
 * followed. What can and cannot be followed is printed on every run - see `FOLLOWED` /
 * `NOT_FOLLOWED` below - because an unfollowed wrapper is a silent hole, and a silent hole in a
 * control is worse than a declared one.
 *
 * WHAT THIS FILE HAD TO FIX ABOUT ITSELF, SECOND TIME
 *
 * That coverage layer reached its fixed point by RE-SCANNING under an iteration cap: aliases got at
 * most 4 passes, wrappers at most 2. Both caps were arbitrary, and worse, both were order-dependent,
 * because each pass mutated the name set while it scanned. A chain declared in dependency order
 * collapsed in one pass; the same chain declared in reverse needed one pass per link and was cut off
 * mid-way, SILENTLY. Every call through a name lost that way stopped being counted as an assertion,
 * and an uncounted assertion after an exit decision is precisely the defect this scanner exists to
 * find - reported as a clean harness. The printed "depth N" was the pass index, not a nesting depth,
 * which is why every wrapper in this tree printed "depth 1" however deep it actually sat.
 *
 * Resolution is now a monotone worklist over a finite domain (`resolveHelpers`): a name is enqueued
 * only if it has never been seen, so each is enqueued at most once and the queue provably drains.
 * Termination is a property of the construction, not of a constant, so there is no cap to tune and
 * no order for it to depend on. The residual step budget is defence in depth only, is unreachable by
 * the argument written at `resolveHelpers`, and if it ever fired it would report the helper set as
 * INCOMPLETE and fail the run rather than return a quietly truncated set.
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
    "a direct identifier alias, `const ok = checkInvertible`, to the full transitive closure - alias chains are resolved to a fixed point with no iteration cap, in any declaration order",
    "a local wrapper with at least one parameter whose body calls a helper, to ANY nesting depth, including wrappers of aliases and aliases of wrappers; the reported depth is the true minimum distance from a real helper",
    "a member call, `suite.check(...)`, matched on the method name",
]

const NOT_FOLLOWED: readonly string[] = [
    "a helper reached only through a value: passed as a callback, stored in an object or array, or selected by index or computed key",
    "a wrapper or alias cycle that never touches a real helper - `function a(x) { b(x) } function b(x) { a(x) }`, or `const a = b; const b = a` - is reached from nothing and so contributes nothing. That is exclusion for want of evidence, not truncation: the resolver converges over such a cycle rather than oscillating in it, and nothing that WAS reached is ever dropped",
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
    /** Greatest wrapper nesting depth actually reached, measured from the nearest real helper. */
    deepest: number
    /**
     * Non-null ONLY if resolution stopped before the worklist drained, which cannot happen with the
     * default budget (see `resolveHelpers`). A non-null value is escalated by the caller to a gating
     * integrity finding: a partially resolved helper set silently under-counts assertions, and an
     * under-counted assertion is exactly the frozen verdict this scanner exists to catch.
     */
    unresolved: string | null
}>

// ---------------------------------------------------------------------------------------------
// coverage resolution: a monotone worklist over a finite domain
// ---------------------------------------------------------------------------------------------

/**
 * The coverage graph, built ONCE per file from the AST.
 *
 * Both edge maps are keyed by the name that must ALREADY be a helper for the edge to fire, which
 * turns "which names are helpers" from a re-scan-until-stable loop into plain reachability:
 *
 *   aliasTargets:    `const ok = check`                     -> edge check -> ok
 *   wrapperCallers:  `function refusesBy(..) { check(..) }`  -> edge check -> refusesBy
 *
 * `domain` is every name an edge can ever ADD. It is fixed before resolution starts and is what the
 * termination argument in `resolveHelpers` rests on.
 */
type CoverageGraph = Readonly<{
    aliasTargets: ReadonlyMap<string, readonly string[]>
    wrapperCallers: ReadonlyMap<string, readonly string[]>
    domain: ReadonlySet<string>
}>

function pushEdge(edges: Map<string, string[]>, from: string, to: string): void {
    const existing = edges.get(from)
    if (existing) existing.push(to)
    else edges.set(from, [to])
}

function coverageGraph(source: ts.SourceFile, functions: readonly FunctionLike[]): CoverageGraph {
    const aliasTargets = new Map<string, string[]>()
    const wrapperCallers = new Map<string, string[]>()
    const domain = new Set<string>()

    walk(source, (node) => {
        if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && ts.isIdentifier(node.initializer)
        ) {
            pushEdge(aliasTargets, node.initializer.text, node.name.text)
            domain.add(node.name.text)
        }
    })

    for (const candidate of functions) {
        if (!candidate.body) continue
        // A zero-argument asserting function is a driver (`main`), not a per-case helper.
        if (candidate.parameters.length === 0) continue
        const callees = new Set<string>()
        walk(candidate.body, (node) => {
            if (!ts.isCallExpression(node)) return
            if (ts.isIdentifier(node.expression)) callees.add(node.expression.text)
            else if (ts.isPropertyAccessExpression(node.expression)) callees.add(node.expression.name.text)
        })
        for (const callee of callees) pushEdge(wrapperCallers, callee, candidate.name)
        domain.add(candidate.name)
    }

    return { aliasTargets, wrapperCallers, domain }
}

type Resolution = Readonly<{
    names: Set<string>
    aliases: readonly string[]
    wrappers: readonly string[]
    deepest: number
    unresolved: string | null
}>

/**
 * Resolve the helper set to its FIXED POINT with a monotone worklist. Replaces two bounded passes -
 * "aliases, at most 4 passes" and "wrappers, at most 2 passes" - that this file used to run.
 *
 * WHY THE OLD FORM WAS WRONG, not merely inelegant. Each old pass re-scanned every candidate while
 * MUTATING the name set, so a chain declared in dependency order collapsed in a single pass while
 * the same chain declared in reverse order needed one pass per link. The caps therefore truncated
 * on DECLARATION ORDER, silently: `const ok5 = ok4 ... const ok1 = check` lost `ok5`, a five-deep
 * reverse wrapper chain lost its top two links, and every call through the lost name stopped
 * counting as an assertion. In a scanner whose whole job is to notice assertions that do not reach
 * the exit code, an uncounted assertion is a missed defect reported as a clean harness. The printed
 * "depth N" was the pass index rather than a nesting depth, which is why every wrapper in the real
 * tree printed "depth 1" no matter how deep it actually sat.
 *
 * TERMINATION, BY CONSTRUCTION - no cap required:
 *   1. `names` starts as `seeds` and only ever grows; nothing is removed.
 *   2. A name is pushed onto `queue` only in the same step that inserts it into `names`, and only
 *      when `names` did not already contain it. So every name is enqueued AT MOST ONCE.
 *   3. Every name an edge can add is a member of `graph.domain`, which is fixed before the loop.
 *   4. Therefore `queue.length <= seeds.size + domain.size` for the whole run, a bound computed
 *      before the first iteration.
 *   5. `head` increases by exactly 1 per iteration and the loop runs only while `head <
 *      queue.length`. By (4) it performs at most `seeds.size + domain.size` iterations and the
 *      queue drains. The domain is finite, so the fixed point is reached in finite time.
 *
 * `budget` is defence in depth, NOT the termination argument, and by (5) it is UNREACHABLE at its
 * default of `seeds.size + domain.size + 1`: the loop cannot execute more than
 * `seeds.size + domain.size` iterations, which is strictly less than the budget. It exists because
 * "this cannot happen" is only worth stating if the alarm behind it is wired - so if the invariant
 * above is ever broken by a later edit, this reports INCOMPLETE resolution and the caller turns
 * that into a gating failure. It never silently returns a truncated set. `--self-test` starves the
 * budget deliberately to prove that path executes.
 *
 * BFS order is load-bearing for the report, not for the result: reaching a name for the first time
 * along a shortest path means the recorded wrapper depth is the TRUE minimum nesting distance from a
 * real helper. The final `names` set is the same under any traversal order, because it is the
 * reachable set of a fixed graph.
 */
function resolveHelpers(graph: CoverageGraph, seeds: ReadonlySet<string>, budget?: number): Resolution {
    const names = new Set(seeds)
    const depths = new Map<string, number>()
    for (const seed of seeds) depths.set(seed, 0)

    const queue = [...seeds]
    const stepBudget = budget ?? seeds.size + graph.domain.size + 1
    const aliases: string[] = []
    const wrappers: string[] = []
    let head = 0
    let steps = 0
    let deepest = 0
    let unresolved: string | null = null

    while (head < queue.length) {
        steps += 1
        if (steps > stepBudget) {
            unresolved = `helper resolution stopped after ${stepBudget} worklist step(s) with ${queue.length - head} name(s) still queued; the helper set is INCOMPLETE and any assertion reached only through an unresolved name was not counted`
            break
        }
        const current = queue[head]
        head += 1
        const currentDepth = depths.get(current) ?? 0

        // An alias is the same function under another name, so it sits at the SAME nesting depth.
        for (const alias of graph.aliasTargets.get(current) ?? []) {
            if (names.has(alias)) continue
            names.add(alias)
            depths.set(alias, currentDepth)
            aliases.push(`${alias} = ${current}`)
            queue.push(alias)
        }

        for (const wrapper of graph.wrapperCallers.get(current) ?? []) {
            if (names.has(wrapper)) continue
            const depth = currentDepth + 1
            names.add(wrapper)
            depths.set(wrapper, depth)
            wrappers.push(`${wrapper} (depth ${depth})`)
            queue.push(wrapper)
            if (depth > deepest) deepest = depth
        }
    }

    return { names, aliases, wrappers, deepest, unresolved }
}

/**
 * The effective assertion-name set for ONE file.
 *
 * Per-file declarations win. A name declared in this file and found not to record a verdict is NOT
 * inherited from elsewhere - that is exactly the `refuses` case, and it is the whole reason a global
 * hardcoded set could not be right.
 *
 * `budget` is for `--self-test` only; production callers omit it and get the unreachable default.
 */
function effectiveNames(
    source: ts.SourceFile,
    discovery: Discovery,
    elsewhere: ReadonlySet<string>,
    budget?: number,
): Effective {
    const seeds = new Set(discovery.base)
    const inherited: string[] = []
    const overridden: string[] = []
    for (const name of elsewhere) {
        if (discovery.declared.has(name)) {
            if (!discovery.base.has(name)) overridden.push(name)
            continue
        }
        seeds.add(name)
        inherited.push(name)
    }

    const resolved = resolveHelpers(coverageGraph(source, discovery.functions), seeds, budget)
    return {
        names: resolved.names,
        aliases: resolved.aliases,
        wrappers: resolved.wrappers,
        inherited,
        overridden,
        deepest: resolved.deepest,
        unresolved: resolved.unresolved,
    }
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

function analyze(file: string, text: string, elsewhere: ReadonlySet<string>, budget?: number): ScanResult {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const discovery = discoverBase(source)
    const effective = effectiveNames(source, discovery, elsewhere, budget)
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

const ADVERSARIAL_ROOT = join(__dirname, "..", "gates", "fixtures")

/**
 * Adversarial fixtures for the coverage FIXED POINT, held on disk under
 * `scripts/gates/fixtures/exit-integrity-*` rather than inline in this file.
 *
 * On disk rather than inline for one reason: they are deliberately NON-COMPILING TypeScript.
 * `const ok5 = ok4` is declared before `ok4` exists, because declaration order is exactly what the
 * old bounded passes were sensitive to, and a chain in reverse order is the only way to show it. A
 * `.ts.txt` file can carry that text without putting it in front of tsc or eslint. The scanner is
 * handed a synthetic `*.ts` filename so the parser still reads the text as TypeScript.
 *
 * A declared fixture whose file is missing or unreadable is a self-test FAILURE, never a skip: a
 * control that quietly stops running is the precise failure mode this scanner exists to prevent.
 */
type AdversarialFixture = Readonly<{
    name: string
    directory: string
    file: string
    covers: string
    expect: Classification | "NO_FINDING"
    /**
     * Worklist step budget. Omitted means the production default, which is unreachable by the
     * argument at `resolveHelpers`. A value here deliberately STARVES resolution, which is the only
     * way to execute the alarm behind an unreachable guard.
     */
    budget?: number
    /** Whether resolution is REQUIRED to report itself incomplete. */
    expectUnresolved: boolean
    /** Recognised assertion calls, asserted only where the exact number is the point. */
    expectAssertionCount?: number
}>

const ADVERSARIAL_FIXTURES: readonly AdversarialFixture[] = [
    {
        name: "alias-cycle-converges",
        directory: "exit-integrity-convergence",
        file: "alias-cycle.ts.txt",
        covers: "CONVERGENCE: a mutually-recursive alias pair the resolver must not oscillate in, plus a five-link alias chain in reverse declaration order that the old 4-pass cap silently truncated",
        expect: "REAL_DEFECT",
        expectUnresolved: false,
    },
    {
        name: "wrapper-cycle-converges",
        directory: "exit-integrity-convergence",
        file: "wrapper-cycle.ts.txt",
        covers: "CONVERGENCE: a REACHABLE wrapper cycle (ping <-> pong, pong calls the helper) that a worklist without a seen-set would enqueue forever, plus a four-link wrapper chain in reverse order that the old 2-pass cap silently truncated",
        expect: "REAL_DEFECT",
        expectUnresolved: false,
    },
    {
        name: "resolution-complete-at-default-budget",
        directory: "exit-integrity-loud-failure",
        file: "starved-resolution.ts.txt",
        covers: "CONTROL for the leg below: with the production budget the same file resolves fully, reports resolution COMPLETE, and finds the frozen verdict",
        expect: "REAL_DEFECT",
        expectUnresolved: false,
    },
    {
        name: "starved-resolution-is-loud",
        directory: "exit-integrity-loud-failure",
        file: "starved-resolution.ts.txt",
        covers: "LOUD FAILURE: resolution starved to one step must report itself INCOMPLETE rather than return a truncated helper set. Note the finding set goes EMPTY when it is starved - that silence is exactly why an incomplete resolution has to be gating",
        expect: "NO_FINDING",
        budget: 1,
        expectUnresolved: true,
    },
    {
        name: "value-mediated-helper-is-loud",
        directory: "exit-integrity-loud-failure",
        file: "value-mediated-helper.ts.txt",
        covers: "LOUD FAILURE: a real helper reached only through an array index and a computed key (NOT_FOLLOWED item 1) yields 0 recognised assertions, which must escalate to the gating NO_ASSERTION_RECOGNISED instead of a green verdict",
        expect: "NO_FINDING",
        expectUnresolved: false,
        expectAssertionCount: 0,
    },
]

/**
 * The pure per-file coverage escalation, separated from the scan for the same reason `reconcile` is:
 * so `--self-test` can prove the loud paths actually fire on a synthetic input rather than assert it
 * in a comment. Returns gating findings and declared, non-gating notes.
 */
function coverageVerdict(
    file: string,
    assertionCount: number,
    unresolved: string | null,
): Readonly<{ gating: IntegrityFinding[]; notes: IntegrityFinding[] }> {
    const gating: IntegrityFinding[] = []
    const notes: IntegrityFinding[] = []

    if (unresolved) {
        gating.push({
            kind: "HELPER_RESOLUTION_INCOMPLETE",
            detail: `${file}: ${unresolved}. This voids the scan of this file rather than reducing it: an assertion reached only through an unresolved name is not counted, and an uncounted assertion after an exit decision is the defect this scanner exists to find. The step budget is unreachable by construction, so reaching it means the worklist invariant in resolveHelpers has been broken by an edit.`,
        })
    }

    if (assertionCount === 0) {
        const reason = NO_HELPER_BY_DESIGN.get(file)
        if (reason) notes.push({ kind: "NO_ASSERTION_RECOGNISED_BY_DESIGN", detail: `${file}: ${reason}` })
        else {
            gating.push({
                kind: "NO_ASSERTION_RECOGNISED",
                detail: `${file} yielded 0 recognised assertion calls with the derived helper set. Its exit integrity cannot be judged, so its silence is not evidence, and it is not on the declared NO_HELPER_BY_DESIGN list. Either the harness asserts through a shape discovery does not recognise - which is a hole in THIS file - or it genuinely asserts nothing.`,
            })
        }
    }

    return { gating, notes }
}

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

    if (!runAdversarialSelfTest(elsewhere)) ok = false
    return ok
}

/**
 * The fixed-point legs. Kept separate because they assert on HOW the helper set was resolved -
 * whether it converged, and whether an incomplete resolution announced itself - not only on which
 * classification came out.
 */
function runAdversarialSelfTest(elsewhere: ReadonlySet<string>): boolean {
    let ok = true
    for (const fixture of ADVERSARIAL_FIXTURES) {
        const path = join(ADVERSARIAL_ROOT, fixture.directory, fixture.file)
        if (!existsSync(path)) {
            console.error(
                `FAIL self-test ${fixture.name}: fixture ${fixture.directory}/${fixture.file} is declared but missing from disk. A declared control that cannot run is a failure, not a skip.`,
            )
            ok = false
            continue
        }
        let text: string
        try {
            text = readFileSync(path, "utf8")
        } catch (error) {
            console.error(
                `FAIL self-test ${fixture.name}: fixture ${fixture.directory}/${fixture.file} could not be read: ${error instanceof Error ? error.message : String(error)}`,
            )
            ok = false
            continue
        }

        // A synthetic .ts name: the file is .ts.txt on disk so tooling leaves it alone, but the
        // parser must still read it as TypeScript.
        const result = analyze(`fixture-${fixture.name}.ts`, text, elsewhere, fixture.budget)
        const unresolved = result.effective.unresolved
        const budgetNote = fixture.budget === undefined ? "production budget" : `starved budget ${fixture.budget}`

        if (fixture.expectUnresolved !== (unresolved !== null)) {
            console.error(
                fixture.expectUnresolved
                    ? `FAIL self-test ${fixture.name}: resolution was starved (${budgetNote}) but reported itself COMPLETE. An incomplete helper set that does not announce itself is a silent truncation.`
                    : `FAIL self-test ${fixture.name}: resolution reported itself incomplete at the ${budgetNote}, which should be unreachable: ${unresolved}`,
            )
            ok = false
            continue
        }

        if (fixture.expectAssertionCount !== undefined && result.assertionCount !== fixture.expectAssertionCount) {
            console.error(
                `FAIL self-test ${fixture.name}: expected ${fixture.expectAssertionCount} recognised assertion call(s), saw ${result.assertionCount}`,
            )
            ok = false
            continue
        }

        // An unjudgeable fixture must escalate, and the escalation itself is asserted here rather
        // than trusted: the gating kinds are what make silence loud.
        if (fixture.expectAssertionCount === 0 || fixture.expectUnresolved) {
            const escalation = coverageVerdict(`fixture-${fixture.name}.ts`, result.assertionCount, unresolved)
            const expectedKind = fixture.expectUnresolved ? "HELPER_RESOLUTION_INCOMPLETE" : "NO_ASSERTION_RECOGNISED"
            if (!escalation.gating.some((finding) => finding.kind === expectedKind)) {
                console.error(
                    `FAIL self-test ${fixture.name}: expected the gating ${expectedKind}, saw ${escalation.gating.map((finding) => finding.kind).join(", ") || "nothing"}`,
                )
                ok = false
                continue
            }
            console.log(
                `PASS self-test ${fixture.name}: gating ${expectedKind} raised at the ${budgetNote} (${fixture.covers})`,
            )
            continue
        }

        const interesting = result.findings.filter((finding) => finding.classification !== "FINAL_VERDICT")
        if (fixture.expect === "NO_FINDING") {
            if (interesting.length > 0) {
                console.error(
                    `FAIL self-test ${fixture.name}: expected no finding, saw ${interesting.map((finding) => `${finding.classification}@${finding.line}`).join(", ")}`,
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
            `PASS self-test ${fixture.name}: ${fixture.expect} at fixture line ${hit.line}, assertions-after=${hit.assertionsAfter}, resolution complete to depth ${result.effective.deepest} (${fixture.covers})`,
        )
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
// harnesses is declared above; a CHANGE to that set is what fails, not its non-emptiness. Resolution
// that stopped short is escalated by the same path, for the same reason.
const unjudgeable: string[] = []
const coverageNotes: IntegrityFinding[] = []
for (let index = 0; index < files.length; index += 1) {
    if (results[index].assertionCount === 0) unjudgeable.push(files[index])
    const verdict = coverageVerdict(files[index], results[index].assertionCount, results[index].effective.unresolved)
    coverageNotes.push(...verdict.notes)
    integrity.push(...verdict.gating)
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
console.log(
    `Helper resolution: monotone worklist to a fixed point, no iteration cap; deepest wrapper nesting reached ${Math.max(0, ...results.map((result) => result.effective.deepest))}; files with resolution reported INCOMPLETE: ${results.filter((result) => result.effective.unresolved !== null).length} (gating).`,
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
