/**
 * check-assertion-vacuity.ts - can the assertion be FALSE at all?
 *
 * `check-harness-exit-integrity.ts` answers a different question: does a verdict that was computed
 * actually reach the exit code. This scanner answers the one underneath it. An assertion can be
 * wired perfectly into the exit code and still assert nothing, because its condition cannot take the
 * value `false` on any run that reaches it. Such an assertion is green forever and measures nothing.
 *
 * The class is real and this repository has paid for it three times, all three found by hand:
 *
 *   1. CONDITIONAL_INIT      558d877, check-inventory-runtime.ts
 *          let t2SettledBeforeRelease = false
 *          if (secondPrewriteBeforeRelease) t2SettledBeforeRelease = await settlesWithin(t2, 1500)
 *          checkInvertible("MEASURED: ...", first && !secondPrewriteBeforeRelease && !t2SettledBeforeRelease, ...)
 *      The second conjunct forces the guard false on every passing run, so the assignment never runs,
 *      the variable keeps its initialiser, and the third conjunct is `!false` - unconditionally true.
 *
 *   2. SELF_COMPARISON       fd3d8fc, check-due-work-preview-api.ts
 *          check("round-trippable JSON", JSON.stringify(JSON.parse(ok.raw)) === JSON.stringify(ok.body))
 *      `ok.body` was itself produced by `JSON.parse(ok.raw)` in the `call()` factory. Both sides are
 *      the same expression. Literally `x === x`.
 *
 *   3. DERIVED_EXPECTATION   fd3d8fc, check-due-work-preview-api.ts
 *          const expected = called.status < 400 ? "data,ok" : "error,ok"
 *          check(..., keys === expected)
 *      The expectation is computed FROM the observation it is checking, so a 403 regressing to a 200
 *      flipped the expectation with it and the assertion still passed. The subtlest of the three.
 *
 * METHOD. TypeScript AST only, no execution, no database. For each assertion call the condition
 * argument is split at top-level `&&` and each conjunct is classified on its own, because a single
 * vacuous conjunct inside an otherwise live `&&` chain is exactly defect 1 and contributes nothing.
 * Under `||` the whole condition is judged together, because one always-true disjunct makes the
 * entire assertion unfalsifiable.
 *
 * A SECOND PASS runs over the wrappers that BUILD a condition rather than forwarding one
 * (`expectOrder(domain, expected, why)`). Their bodies are scanned in place like any other code, but
 * in the body the expected value is an opaque parameter, so a defect-3 introduced at the CALLSITE is
 * invisible there. Each callsite argument is therefore substituted for the parameter and the SAME
 * detector chain re-run, reporting only what the in-place scan could not reach. See
 * `scanBuilderCallsites`.
 *
 * PRECEDENCE. A conjunct gets exactly one class, tried in this order, so nothing is double counted:
 * LITERAL, TAUTOLOGY, SELF_COMPARISON, DERIVED_EXPECTATION, CONDITIONAL_INIT, UNGUARDED_EVERY.
 * `typeof x === typeof x` therefore lands in TAUTOLOGY rather than SELF_COMPARISON, matching the way
 * the class list was handed down. Anything suspicious that cannot be settled goes to UNRESOLVED with
 * the reasoning attached rather than being counted as a defect.
 *
 * SELF-EXCLUSION. This file excludes itself, by basename, for the same reason the exit-integrity
 * scanner does: its detector logic and its `--self-test` fixtures necessarily CONTAIN every shape it
 * hunts, as string literals and as deliberately vacuous fixture code. Scanning itself would report
 * its own evidence as defects. No other file is excluded.
 *
 * FLAGS
 *   (none)            scan every check-*.ts beside this file; exit 1 if a real defect is found
 *   --file <path>      scan explicit files instead (used to re-check historical commits via
 *                      `git show <sha>^:<path> > tmp`, which never touches the working tree)
 *   --self-test        run the in-memory fixture suite: one vacuous fixture per class that must be
 *                      caught, plus a live control per class that must NOT be flagged
 *   --prove-failure    add a synthetic vacuous fixture to the findings, so a passing tree still exits 1
 *   --quiet            suppress the per-finding lines, print only the counts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import ts from "typescript"

type Classification =
    | "VACUOUS_LITERAL"
    | "VACUOUS_TAUTOLOGY"
    | "VACUOUS_CONDITIONAL_INIT"
    | "VACUOUS_SELF_COMPARISON"
    | "VACUOUS_DERIVED_EXPECTATION"
    | "UNGUARDED_EVERY"
    | "VACUOUS_ALIAS_IDENTITY"
    | "VACUOUS_UNREACHED_INITIALISER"
    | "VACUOUS_EMPTY_REPLAY"
    | "VACUOUS_MIRRORED_DERIVATION"
    | "VACUOUS_DOMINATED_CONJUNCT"
    | "INTENTIONAL_FIXTURE_SELF_CHECK"
    | "UNRESOLVED"
    | "LIVE"

type Finding = Readonly<{
    file: string
    line: number
    helper: string
    assertion: string
    conjunct: string
    classification: Classification
    evidence: string
}>

/**
 * What the coverage layer cannot follow. Printed on every run, because an unfollowed indirection is a
 * silent hole and a silent hole in a control is worse than a declared one.
 */
const COVERAGE_LIMITS: readonly string[] = [
    "a helper reached only through a value: passed as a callback, stored in an object or array, or selected by index or computed key",
    "an argument to a condition-BUILDING wrapper (expectOrder, protectedCase, expectRuntimeError, and the drivers that take an observation handle) whose derivation from the code under test cannot be settled on source text: the callsite argument IS now substituted into the wrapper's own condition and re-classified, but substitution stops where canonicalisation stops - an argument computed inside ANOTHER function, or one that becomes textually identical to the observation through calls this scanner cannot prove side-effect free, is reported UNRESOLVED rather than counted",
    "a condition-building wrapper whose condition parameter shares its NAME with a file-level binding: substitution is keyed by name, so it is skipped rather than risk reasoning about the wrong value (reported per file when it happens)",
    "a helper imported from another module: `import` bindings are not resolved (no harness in this tree shares a helper file today)",
    "a condition assembled at runtime - built by string, selected from a table of predicates, or produced by a factory called with different arguments per callsite",
]

/**
 * Safety bound on wrapper-discovery rounds. This is NOT a coverage limit, and it is deliberately not
 * listed as one.
 *
 * The loop's real terminator is the FIXED POINT: a round that registers nothing. It was previously
 * bounded at 2 rounds as well, which was the only thing stopping the chain closing, and that bound
 * WAS a coverage hole - a wrapper three levels above a real helper was silently not a helper, so every
 * assertion made through it was not an assertion as far as this scanner was concerned. Nothing about
 * the algorithm needed it: each round can only register a wrapper whose callee is already known, so
 * the number of rounds a file needs is the depth of its longest wrapper chain plus one, and a round
 * that registers nothing proves no deeper chain exists.
 *
 * The bound survives only so that a pathological input cannot spin forever. It is REPORTED when it is
 * reached (`wrapperRoundsExhausted`), and reaching it FAILS the run, because a silently truncated
 * discovery is exactly the kind of undeclared hole this scanner exists to prevent. MEASURED: the
 * deepest chain in this tree is 1 wrapper, which converges in 2 rounds; the depth-4 self-test fixture
 * converges in 5.
 */
const MAX_WRAPPER_ROUNDS = 16

const SELF_NAME = "check-assertion-vacuity.ts"
const MANIFEST_PATH = join(__dirname, "..", "gates", "gates.manifest.json")

/** Classes that mean "this assertion cannot fail", i.e. a real defect. */
const VACUOUS: readonly Classification[] = [
    "VACUOUS_LITERAL",
    "VACUOUS_TAUTOLOGY",
    "VACUOUS_CONDITIONAL_INIT",
    "VACUOUS_SELF_COMPARISON",
    "VACUOUS_DERIVED_EXPECTATION",
    "UNGUARDED_EVERY",
    "VACUOUS_ALIAS_IDENTITY",
    "VACUOUS_UNREACHED_INITIALISER",
    "VACUOUS_EMPTY_REPLAY",
    "VACUOUS_MIRRORED_DERIVATION",
    "VACUOUS_DOMINATED_CONJUNCT",
]

/**
 * MUTATION SWITCH. Each key names ONE detector - the five classes added by the falsifiability wave,
 * plus the dominance rule inside `detectUnguardedEvery` - and disabling a key makes exactly that
 * detector return nothing.
 *
 * WHY A SWITCH IS SAFE HERE AND WHY IT CANNOT BE A BYPASS. A detector nobody can turn off is a
 * detector nobody can PROVE is load-bearing: "the fixture is flagged" is equally true of a fixture
 * flagged by some OTHER class, or by a coincidence of precedence. So `runMutationProofs` turns each key
 * off, re-scans that key's own positive fixture, and requires the finding to DISAPPEAR - then restores
 * it. Those proofs run on every invocation and are recorded through `recordSelfCheck`, so they gate.
 *
 * The switch can never buy a green run. `--mutate-disable=<KEY>` marks the whole run VOID and forces a
 * non-zero exit whatever the findings are (see the entry section), and the in-process proofs restore
 * every key in a `finally`. There is no environment variable and no config file: a mutation must be
 * asked for on the command line, and asking for one is the same as asking for exit 1.
 */
const MUTABLE_DETECTORS = [
    "ALIAS_IDENTITY",
    "UNREACHED_INITIALISER",
    "EMPTY_REPLAY",
    "MIRRORED_DERIVATION",
    "DOMINATED_CONJUNCT",
    "EVERY_DOMINANCE",
] as const

type MutableDetector = (typeof MUTABLE_DETECTORS)[number]

const disabledDetectors = new Set<MutableDetector>()

function detectorEnabled(key: MutableDetector): boolean {
    return !disabledDetectors.has(key)
}

/** Run `body` with `key` disabled, restoring the PRIOR state however `body` ends. */
function withDetectorDisabled<T>(key: MutableDetector, body: () => T): T {
    // Restoring the prior state rather than unconditionally deleting matters for exactly one caller:
    // a `--mutate-disable=<KEY>` run, where the key is ALREADY off for the whole process. An
    // unconditional delete there would silently switch the detector back on halfway through the run
    // the operator asked to be a mutation, which is the one thing a mutation switch must never do.
    const wasDisabled = disabledDetectors.has(key)
    disabledDetectors.add(key)
    try {
        return body()
    } finally {
        if (!wasDisabled) disabledDetectors.delete(key)
    }
}

/**
 * Helper names with the argument index that carries the condition. This is a FALLBACK ONLY: the real
 * set is discovered per file from the AST, because the parameter is variously named
 * condition / pass / ok / observed / expectation.
 *
 * Every use of this map is REPORTED (`FALLBACK_USED`), because a name covered only because it is
 * written here is a name discovery failed on, and that is a hole worth seeing rather than a default
 * worth trusting. As of the Q2-A audit the fallback fires for nothing: all three names are found from
 * source in every file that uses them.
 */
const FALLBACK_HELPERS: ReadonlyMap<string, number> = new Map([
    ["check", 1],
    ["checkInvertible", 1],
    ["assert", 0],
])

/** Parameter names this repository actually uses for "the thing that must be true". */
const CONDITION_PARAMETERS = new Set(["condition", "pass", "passed", "ok", "holds", "observed", "expectation", "truth"])

/** Targets whose mutation is a recorded verdict, so a helper that writes one is a real helper. */
const VERDICT_TARGET = /result|failure|assertion|coverage|verdict|defect|problem/iu

/** Roots that carry no observation of their own, so sharing one proves nothing about derivation. */
const BUILTIN_ROOTS = new Set([
    "Object", "JSON", "Array", "Number", "String", "Boolean", "Math", "Date", "Set", "Map", "RegExp",
    "Promise", "Symbol", "BigInt", "Error", "process", "console", "globalThis", "undefined", "NaN",
    "Infinity", "ts", "prisma", "require", "module", "exports",
])

/** Words that, in an assertion name or its leading comment, are evidence of a deliberate fixture check. */
const FIXTURE_EVIDENCE = /\b(?:fixture|deliberate(?:ly)?|on purpose|by construction|sanity|self-test|selftest|control|controlled|precondition|smoke|tautolog\w*|placeholder|scaffold)\b/iu

/**
 * What the FALSIFIABILITY layer deliberately does not decide. Same principle as `COVERAGE_LIMITS`: a
 * hole that is declared can be argued about, and a hole that is silent gets mistaken for a clean
 * result. Every item here is a case where the analysis could not PROVE unfalsifiability, so the shape
 * is either reported UNRESOLVED or not reported at all - never counted as a defect.
 */
const FALSIFIABILITY_LIMITS: readonly string[] = [
    "a boolean whose assignment IS reachable but is never actually taken on the data this suite happens to produce: `let ok = true; for (...) if (bad) ok = false` is treated as FALSIFIABLE, because deciding otherwise needs the runtime. Only two forms are proven - the binding is never written anywhere in the file, or every guard on every assignment folds to a constant false with this file's own compile-time constants substituted",
    "a replay loop whose trip count cannot be read off its head - a `while`, a `do`, or a `for` whose condition is not a length comparison: reported UNRESOLVED rather than counted, because whether zero iterations is reachable is a runtime question",
    "a replay accumulator that is ALSO a plain `=`-assigned conditional variable: the conditional-init detector answers first by design, so the shape is reported in that class instead (check-retainer-runtime.ts:495 is the instance)",
    "emptiness of a collection built only from imported bindings: decided in another module, so both the every-receiver and the replay-iterable forms are reported UNRESOLVED",
    "conjunct domination beyond one subject compared against constants: `a.length > 0 && b.length > 0` where an invariant elsewhere ties `a` and `b` is not reasoned about, and a conjunct separated from its dominator by anything with a possible effect is left alone",
    "alias identity through a nested destructuring pattern, a rest element, a computed key that is not a constant, or a name bound twice in one file: each drops the alias rather than resolve it to the wrong binding",
]

function lineOf(source: ts.SourceFile, node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function textOf(source: ts.SourceFile, node: ts.Node): string {
    return node.getText(source)
}

/** Whitespace-insensitive form, so `a === a` and `a\n    === a` compare equal. */
function normalize(source: ts.SourceFile, node: ts.Node): string {
    return textOf(source, node).replace(/\s+/gu, "")
}

function oneLine(value: string, limit = 150): string {
    const flat = value.replace(/\s+/gu, " ").trim()
    return flat.length <= limit ? flat : `${flat.slice(0, limit - 1)}\u2026`
}

function unwrap(node: ts.Expression): ts.Expression {
    let current = node
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
        current = current.expression
    }
    return current
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

/** The innermost enclosing function-like node, or the source file. */
function enclosingScope(node: ts.Node): ts.Node {
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) current = current.parent
    return current ?? node.getSourceFile()
}

// ---------------------------------------------------------------------------------------------
// assertion helper discovery
// ---------------------------------------------------------------------------------------------

/** A helper that RECORDS a verdict, as opposed to one that merely returns a boolean. */
function recordsVerdict(body: ts.Node | undefined): boolean {
    if (!body) return false
    return contains(body, (candidate) => {
        if (ts.isThrowStatement(candidate)) return true
        if (
            ts.isCallExpression(candidate)
            && ts.isPropertyAccessExpression(candidate.expression)
            && candidate.expression.name.text === "push"
        ) return true
        // `check-foundation-contracts.ts` records with `failures += 1`, not `=`. Requiring a plain
        // assignment silently dropped that helper, so every assignment operator counts, and so does
        // `failures++`.
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

function conditionParameterIndex(parameters: ts.NodeArray<ts.ParameterDeclaration>): number {
    for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index]
        if (!ts.isIdentifier(parameter.name)) continue
        if (!CONDITION_PARAMETERS.has(parameter.name.text)) continue
        const kind = parameter.type?.kind
        if (kind === ts.SyntaxKind.BooleanKeyword || kind === ts.SyntaxKind.UnknownKeyword || kind === undefined) {
            return index
        }
    }
    return -1
}

type FunctionLike = Readonly<{
    name: string
    parameters: ts.NodeArray<ts.ParameterDeclaration>
    body: ts.Node | undefined
}>

/** `function f`, `const f = () => {}`, `const f = function () {}`; anything else is not a named helper. */
function asFunctionLike(node: ts.Node): FunctionLike | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
        return { name: node.name.text, parameters: node.parameters, body: node.body }
    }
    if (
        ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
        return { name: node.name.text, parameters: node.initializer.parameters, body: node.initializer.body }
    }
    return null
}

/**
 * Which of `parameters` appear in BOOLEAN POSITION inside `expression`.
 *
 * Boolean position means: the whole expression, the operand of `!`, an operand of `&&`/`||`/`??`, or
 * the test or either branch of `?:`. Descent stops at anything else - a comparison, a call, a property
 * access - because past that point the parameter is an INPUT to the condition rather than the
 * condition, and treating it as the condition is how a scanner invents defects.
 */
function collectBooleanPositions(expression: ts.Expression, parameters: ReadonlySet<string>, out: Set<string>): void {
    const target = unwrap(expression)
    if (ts.isIdentifier(target)) {
        if (parameters.has(target.text)) out.add(target.text)
        return
    }
    if (ts.isAwaitExpression(target)) {
        collectBooleanPositions(target.expression, parameters, out)
        return
    }
    if (ts.isPrefixUnaryExpression(target) && target.operator === ts.SyntaxKind.ExclamationToken) {
        collectBooleanPositions(target.operand, parameters, out)
        return
    }
    if (ts.isBinaryExpression(target)) {
        const kind = target.operatorToken.kind
        if (
            kind === ts.SyntaxKind.AmpersandAmpersandToken
            || kind === ts.SyntaxKind.BarBarToken
            || kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
            collectBooleanPositions(target.left, parameters, out)
            collectBooleanPositions(target.right, parameters, out)
        }
        return
    }
    if (ts.isConditionalExpression(target)) {
        collectBooleanPositions(target.condition, parameters, out)
        collectBooleanPositions(target.whenTrue, parameters, out)
        collectBooleanPositions(target.whenFalse, parameters, out)
    }
}

type HelperDiscovery = Readonly<{
    helpers: ReadonlyMap<string, number>
    /** Names found by direct verdict recording, the strongest evidence. */
    direct: ReadonlySet<string>
    wrappers: readonly string[]
    aliases: readonly string[]
    /** Names covered ONLY because FALLBACK_HELPERS names them: a discovery miss worth seeing. */
    fallbackUsed: readonly string[]
    /** Rounds the wrapper fixed point actually took, and whether it converged inside the safety bound. */
    wrapperRounds: number
    wrapperRoundsExhausted: boolean
    notes: readonly string[]
}>

/**
 * The assertion helpers this file actually defines, with the index of the condition argument.
 * Discovered from the AST so a helper with an unusual parameter name is not missed, then extended
 * along two paths that a name-only scan cannot see, and only then backstopped by the fallback set.
 *
 * ALIASES. `const ok = checkInvertible` makes every `ok(...)` an assertion whose condition lives at
 * the callsite. MEASURED: no harness in this tree does this today. It is followed anyway, because the
 * cost is six lines and the failure mode is a whole harness silently uncovered.
 *
 * FORWARDING WRAPPERS. This one is not hypothetical. EIGHT harnesses declare
 *
 *     function checkInvertible(name: string, pass: boolean, detail = "") {
 *         check(name, INVERT ? !pass : pass, detail)
 *     }
 *
 * which records nothing itself - it hands `pass` to `check`. `recordsVerdict` is false for it, so
 * discovery MISSED it and it was covered only because the literal name `checkInvertible` happens to
 * be in the fallback map. Rename it and eight harnesses would have gone silently unscanned. Wrappers
 * are now derived, so the coverage no longer depends on a name.
 *
 * WRAPPERS OF WRAPPERS, TO A FIXED POINT. A round can only register a wrapper whose callee is ALREADY
 * a known helper, and the walk visits declarations in source order, so a chain declared outermost
 * first needs one round per link. The loop iterates until a round registers nothing - the fixed point,
 * which PROVES no deeper chain exists - bounded only by `MAX_WRAPPER_ROUNDS` as a runaway guard that
 * fails loudly if it is ever reached. It was previously bounded at 2 rounds, and that bound was a real
 * hole: a wrapper three links above a real helper was not a helper, so every assertion made through it
 * was invisible. The depth-3 and depth-4 self-test fixtures register at rounds 3 and 4, which no
 * two-round loop can produce, so they cannot pass under the old bound.
 *
 * THE SOUNDNESS RULE. A wrapper is registered only when a parameter reaches the base helper's
 * condition slot in BOOLEAN POSITION - as the whole condition, under `!`, as an operand of
 * `&&`/`||`/`??`, or as a branch or test of `?:`. A parameter appearing as an operand of `===`, or as
 * a property or call receiver, does NOT count, and that exclusion is what keeps this honest:
 *
 *     expectRuntimeError(action, code, msg) -> assert(caught instanceof E && caught.code === code)
 *     expectOrder(domain, expected, why)    -> checkInvertible(..., got.join(",") === expected.join(","))
 *     protectedCase(test)                   -> check(..., await test.ownerSucceeded())
 *
 * In all three the wrapper BUILDS the condition; the argument at the callsite is a string, an array
 * or a fixture handle. Registering them would hand a non-boolean to the detectors, and `fold` would
 * report a string argument as a constant-true VACUOUS_LITERAL - a fabricated defect. Their real
 * conditions are already scanned in place, inside the wrapper body, where they are written.
 *
 * AND IN-PLACE IS NOT ENOUGH, WHICH IS WHY `scanBuilderCallsites` EXISTS. Scanning the body covers the
 * condition's SHAPE, but inside the body the callsite argument is an OPAQUE PARAMETER: it has no
 * definition, so `resolveToExpression` returns null and `observationRoots` sees a bare name. A
 * VACUOUS_DERIVED_EXPECTATION introduced at the CALLSITE - an expected value computed from the very
 * observation the body compares it against - is therefore structurally invisible to the in-place scan,
 * and that is the subtlest of the three classes and the one this repository has actually shipped. So
 * these wrappers are found separately, by `discoverConditionBuilders`, and each callsite argument is
 * substituted into the wrapper's own condition and put through the SAME detector chain.
 */
function discoverHelpers(source: ts.SourceFile): HelperDiscovery {
    const helpers = new Map<string, number>()
    const notes: string[] = []

    // ---- tier 1: direct recorders --------------------------------------------------------------
    walk(source, (node) => {
        const candidate = asFunctionLike(node)
        if (!candidate) return
        const index = conditionParameterIndex(candidate.parameters)
        if (index < 0) return
        if (!recordsVerdict(candidate.body)) return
        const existing = helpers.get(candidate.name)
        if (existing === undefined || existing === index) helpers.set(candidate.name, index)
    })
    const direct = new Set(helpers.keys())

    // ---- tier 2: condition-forwarding wrappers, to a fixed point -------------------------------
    const wrappers: string[] = []
    let wrapperRounds = 0
    let converged = false
    while (wrapperRounds < MAX_WRAPPER_ROUNDS) {
        wrapperRounds += 1
        let grew = false
        walk(source, (node) => {
            const candidate = asFunctionLike(node)
            if (!candidate || !candidate.body || helpers.has(candidate.name)) return
            const parameters = new Map<string, number>()
            candidate.parameters.forEach((parameter, index) => {
                if (ts.isIdentifier(parameter.name)) parameters.set(parameter.name.text, index)
            })
            if (parameters.size === 0) return
            let registered: number | null = null
            let via = ""
            walk(candidate.body as ts.Node, (inner) => {
                if (registered !== null) return
                if (!ts.isCallExpression(inner)) return
                const callee = calleeName(inner)
                if (!callee) return
                const conditionIndex = helpers.get(callee)
                if (conditionIndex === undefined) return
                const condition = inner.arguments[conditionIndex]
                if (!condition) return
                const forwarded = new Set<string>()
                collectBooleanPositions(condition, new Set(parameters.keys()), forwarded)
                if (forwarded.size !== 1) return
                const name = [...forwarded][0]
                registered = parameters.get(name) as number
                via = `${callee}(arg${conditionIndex} carries parameter \`${name}\`)`
            })
            if (registered === null) return
            helpers.set(candidate.name, registered)
            wrappers.push(`${candidate.name} @cond=${registered} via ${via} (round ${wrapperRounds})`)
            grew = true
        })
        if (!grew) {
            converged = true
            break
        }
    }

    // ---- tier 3: direct identifier aliases -----------------------------------------------------
    const aliases: string[] = []
    for (let round = 0; round < 4; round += 1) {
        let grew = false
        walk(source, (node) => {
            if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return
            if (!ts.isIdentifier(node.initializer)) return
            const target = helpers.get(node.initializer.text)
            if (target === undefined || helpers.has(node.name.text)) return
            helpers.set(node.name.text, target)
            aliases.push(`${node.name.text} = ${node.initializer.text} @cond=${target}`)
            grew = true
        })
        if (!grew) break
    }

    // ---- tier 4: the fallback, reported whenever it is the only reason a name is covered --------
    const fallbackUsed: string[] = []
    for (const [name, index] of FALLBACK_HELPERS) {
        if (helpers.has(name)) continue
        // Only note it when the file actually calls the name; an unused fallback entry is harmless.
        let called = false
        walk(source, (node) => {
            if (ts.isCallExpression(node) && calleeName(node) === name) called = true
        })
        helpers.set(name, index)
        if (called) fallbackUsed.push(name)
    }

    for (const name of direct) notes.push(`${name} @cond=${helpers.get(name)} (declared, records a verdict)`)
    return {
        helpers,
        direct,
        wrappers,
        aliases,
        fallbackUsed,
        wrapperRounds,
        wrapperRoundsExhausted: !converged,
        notes,
    }
}

function calleeName(node: ts.CallExpression): string | null {
    if (ts.isIdentifier(node.expression)) return node.expression.text
    if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text
    return null
}

// ---------------------------------------------------------------------------------------------
// definitions, provenance, and constant folding
// ---------------------------------------------------------------------------------------------

type Definition = Readonly<{
    initializer: ts.Expression | null
    /** `true` when the binding is `const`, or a `let` never reassigned AND never mutated in place. */
    stable: boolean
    /** Plain `x = ...` reassignments only. The detectors that read `.right` need that shape. */
    assignments: readonly ts.BinaryExpression[]
    /** Absent for a SYNTHESISED binding, i.e. a wrapper parameter bound to a callsite argument. */
    declaration?: ts.VariableDeclaration
}>

/**
 * Every simple `const`/`let x = init` binding in the file, with its reassignments counted.
 *
 * STABILITY MUST INCLUDE `+=` AND `++`. This originally counted only `=`, and the cost was measurable:
 * `let refusedCount = 0 ... refusedCount += 1 ... check(..., totalIllegal > 0 && refusedCount === totalIllegal)`
 * has two counters that both LOOK like the constant 0 to a scanner that ignores `+=`. `canonical`
 * inlined both initialisers, the two sides became the identical text `(0)`, and three harnesses
 * (check-appointment-authz, check-case-runtime, check-reservation-authz) were reported as
 * "resolves to the same expression - looks like x === x" when they are live counter comparisons with a
 * `> 0` guard already in the same condition. Three of the twenty-three unresolved findings at Q2-A were
 * this scanner's own bug, not a property of the tree.
 *
 * `assignments` deliberately stays `=`-only: `detectConditionalInit` and `detectDerivedExpectation`
 * read `assignment.right` to reason about what value was stored, and `x += 1` has no such right-hand
 * value in that sense. An in-place mutation makes the binding unstable without pretending to say
 * what it became.
 */
function buildDefinitions(source: ts.SourceFile): Map<string, Definition> {
    const declarations = new Map<string, ts.VariableDeclaration>()
    const assignments = new Map<string, ts.BinaryExpression[]>()
    const mutated = new Set<string>()
    walk(source, (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            // A name declared twice in one file cannot be resolved without full scope analysis;
            // drop it rather than resolve it to the wrong binding.
            if (declarations.has(node.name.text)) declarations.set(node.name.text, node)
            else declarations.set(node.name.text, node)
        }
        if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) {
            mutated.add(node.left.text)
            if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return
            const list = assignments.get(node.left.text) ?? []
            list.push(node)
            assignments.set(node.left.text, list)
        }
        if (
            (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
            && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
            && ts.isIdentifier(node.operand)
        ) mutated.add(node.operand.text)
    })
    const duplicated = new Set<string>()
    const seen = new Set<string>()
    walk(source, (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            if (seen.has(node.name.text)) duplicated.add(node.name.text)
            seen.add(node.name.text)
        }
    })
    const definitions = new Map<string, Definition>()
    for (const [name, declaration] of declarations) {
        if (duplicated.has(name)) continue
        const reassignments = assignments.get(name) ?? []
        definitions.set(name, {
            initializer: declaration.initializer ?? null,
            stable: !mutated.has(name),
            assignments: reassignments,
            declaration,
        })
    }
    return definitions
}

/**
 * Canonical text for an expression, with stable local bindings inlined.
 *
 * This is what lets `keys` be compared against the expression it was computed from, and what turns
 * the two sides of defect 2 into the same string. Bounded depth and a visiting set keep it finite.
 */
function canonical(
    source: ts.SourceFile,
    node: ts.Node,
    definitions: ReadonlyMap<string, Definition>,
    depth = 0,
    visiting: ReadonlySet<string> = new Set(),
): string {
    if (depth > 6) return normalize(source, node)
    if (ts.isIdentifier(node)) {
        const definition = definitions.get(node.text)
        if (!definition || !definition.stable || !definition.initializer || visiting.has(node.text)) {
            return node.text
        }
        const next = new Set(visiting)
        next.add(node.text)
        return `(${canonical(source, definition.initializer, definitions, depth + 1, next)})`
    }
    const children: ts.Node[] = []
    ts.forEachChild(node, (child) => {
        children.push(child)
    })
    if (children.length === 0) return normalize(source, node)
    // Rebuild the text by splicing canonicalised children into the original span, so operators,
    // punctuation and literals survive verbatim.
    let out = ""
    let cursor = node.getStart(source)
    const full = source.text
    for (const child of children) {
        out += full.slice(cursor, child.getStart(source))
        out += canonical(source, child, definitions, depth + 1, visiting)
        cursor = child.getEnd()
    }
    out += full.slice(cursor, node.getEnd())
    return out.replace(/\s+/gu, "")
}

type FieldFact = Readonly<{
    field: string
    /** Template over the receiver, with `\u0000R` standing for it, e.g. `JSON.parse(\u0000R.raw)`. */
    template: string
    line: number
    alternatives: number
}>

/** Every expression the name `target` is given inside `scope`: its initialiser and each assignment. */
function localSources(scope: ts.Node, target: string): ts.Expression[] {
    const sources: ts.Expression[] = []
    walk(scope, (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === target && node.initializer) {
            sources.push(node.initializer)
        }
        if (
            ts.isBinaryExpression(node)
            && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isIdentifier(node.left)
            && node.left.text === target
        ) sources.push(node.right)
    })
    return sources
}

/**
 * Facts of the form "for objects built by this file, `.body` IS `JSON.parse(.raw)`".
 *
 * Defect 2 is invisible without one: `ok.body` and `JSON.parse(ok.raw)` are different text for the
 * same value, and the derivation lives inside the `call()` factory rather than at the comparison.
 * Only object literals whose property is derived from a SIBLING property of the same literal produce
 * a fact, which is the shape of a "response envelope" helper and little else.
 */
function buildFieldFacts(source: ts.SourceFile): FieldFact[] {
    const facts: FieldFact[] = []
    walk(source, (node) => {
        if (!ts.isObjectLiteralExpression(node)) return
        const siblings = new Set<string>()
        for (const property of node.properties) {
            if (ts.isShorthandPropertyAssignment(property)) siblings.add(property.name.text)
            else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) siblings.add(property.name.text)
        }
        if (siblings.size < 2) return
        const scope = enclosingScope(node)
        for (const property of node.properties) {
            let field: string | undefined
            let sources: ts.Expression[] = []
            if (ts.isShorthandPropertyAssignment(property)) {
                field = property.name.text
                sources = localSources(scope, field)
            } else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
                field = property.name.text
                sources = [property.initializer]
            }
            if (!field) continue
            for (const raw of sources) {
                const candidate = unwrap(raw)
                if (!ts.isCallExpression(candidate)) continue
                const referenced = [...siblings].filter(
                    (sibling) => sibling !== field && contains(candidate, (n) => ts.isIdentifier(n) && n.text === sibling),
                )
                if (referenced.length !== 1) continue
                const template = normalize(source, candidate).replace(
                    new RegExp(`\\b${referenced[0]}\\b`, "gu"),
                    "\u0000R.$&",
                )
                facts.push({ field, template, line: lineOf(source, candidate), alternatives: sources.length })
            }
        }
    })
    return facts
}

/** Rewrite `X.field` to the derivation the factory gives it, once, for one fact. */
function applyFieldFact(text: string, fact: FieldFact): string {
    const pattern = new RegExp(`([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)\\.${fact.field}\\b`, "gu")
    return text.replace(pattern, (_match, receiver: string) => fact.template.replace(/\u0000R/gu, receiver))
}

/**
 * Deterministic and side-effect free, so the SAME TEXT evaluated twice denotes the same value.
 *
 * This is the load-bearing guard on the self-comparison detector. Without it every
 * `const before = await counts(); const after = await counts(); check(..., before === after)` in this
 * repository canonicalises to `(await counts()) === (await counts())` and is falsely reported as
 * `x === x`, when in fact it is the strongest kind of assertion here: two real observations of a
 * mutable system, taken at different times, required to agree.
 */
const PURE_METHODS = new Set([
    "join", "sort", "slice", "map", "filter", "trim", "toLowerCase", "toUpperCase", "includes",
    "startsWith", "endsWith", "split", "concat", "find", "findIndex", "some", "every", "indexOf",
    "lastIndexOf", "replace", "replaceAll", "padStart", "padEnd", "toFixed", "toString", "charCodeAt",
    "charAt", "at", "flat", "flatMap", "reduce", "keys", "values", "entries", "stringify", "parse",
    "isArray", "isFinite", "isInteger", "isNaN", "freeze", "abs", "min", "max", "floor", "ceil",
    "round", "repeat", "normalize", "localeCompare", "toISOString", "getTime", "match", "test", "from",
])

const PURE_FUNCTIONS = new Set(["String", "Number", "Boolean", "BigInt", "Array"])

const ASSIGNMENT_OPERATORS = new Set([
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

function isPure(node: ts.Node): boolean {
    let pure = true
    walk(node, (candidate) => {
        if (!pure) return
        if (!impureNode(candidate)) return
        pure = false
    })
    return pure
}

function impureNode(candidate: ts.Node): boolean {
    if (ts.isAwaitExpression(candidate) || ts.isNewExpression(candidate) || ts.isYieldExpression(candidate)) return true
    if (ts.isBinaryExpression(candidate) && ASSIGNMENT_OPERATORS.has(candidate.operatorToken.kind)) return true
    if (ts.isPostfixUnaryExpression(candidate) || ts.isDeleteExpression(candidate)) return true
    if (!ts.isCallExpression(candidate)) return false
    if (ts.isPropertyAccessExpression(candidate.expression)) return !PURE_METHODS.has(candidate.expression.name.text)
    if (ts.isIdentifier(candidate.expression)) return !PURE_FUNCTIONS.has(candidate.expression.text)
    return true
}

/**
 * Purity of an expression AFTER stable bindings are inlined.
 *
 * The shallow check is not enough for the self-comparison detector: `taskOne.id === taskReplay.id` is
 * two pure property reads, but each name was bound by its own `await service.enqueueTask(...)`, so the
 * comparison is a real idempotency assertion. Following the bindings is what tells the two apart.
 */
function deeplyPure(
    node: ts.Node,
    definitions: ReadonlyMap<string, Definition>,
    depth = 0,
    visiting: ReadonlySet<string> = new Set(),
): boolean {
    if (depth > 6) return false
    let pure = true
    walk(node, (candidate) => {
        if (!pure) return
        if (impureNode(candidate)) {
            pure = false
            return
        }
        if (!ts.isIdentifier(candidate)) return
        const parent = candidate.parent
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === candidate) return
        if (parent && ts.isPropertyAssignment(parent) && parent.name === candidate) return
        if (visiting.has(candidate.text)) return
        const definition = definitions.get(candidate.text)
        if (!definition || !definition.stable || !definition.initializer) return
        const next = new Set(visiting)
        next.add(candidate.text)
        if (!deeplyPure(definition.initializer, definitions, depth + 1, next)) pure = false
    })
    return pure
}

/** Is this expression provably a non-empty collection from its own syntax? */
function provablyNonEmpty(context: Context, node: ts.Expression, depth = 0): boolean {
    if (depth > 4) return false
    const target = resolveToExpression(context, node, depth) ?? unwrap(node)
    if (ts.isArrayLiteralExpression(target)) return target.elements.length > 0
    if (ts.isCallExpression(target) && ts.isPropertyAccessExpression(target.expression)) {
        const method = target.expression.name.text
        // `.map` preserves length, so a non-empty receiver stays non-empty. `.filter` does not.
        if (method === "map" || method === "sort" || method === "concat") {
            return provablyNonEmpty(context, target.expression.expression, depth + 1)
        }
        if (method === "keys" || method === "values" || method === "entries") {
            const argument = target.arguments[0]
            if (argument) {
                const resolved = resolveToExpression(context, argument, depth) ?? unwrap(argument)
                if (ts.isObjectLiteralExpression(resolved)) return resolved.properties.length > 0
                if (ts.isArrayLiteralExpression(resolved)) return resolved.elements.length > 0
            }
        }
    }
    return false
}

/** Names this file imports, so a receiver whose emptiness is decided in another module is visible. */
function importedNames(source: ts.SourceFile): Set<string> {
    const names = new Set<string>()
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
        const clause = statement.importClause
        if (clause.name) names.add(clause.name.text)
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) names.add(element.name.text)
        }
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            names.add(clause.namedBindings.name.text)
        }
    }
    return names
}

type Constant = boolean | number | string | null | undefined

/** Constant folding over literals and a supplied environment. `undefined` means "not constant". */
function fold(node: ts.Expression, environment: ReadonlyMap<string, Constant>): Constant {
    const target = unwrap(node)
    if (target.kind === ts.SyntaxKind.TrueKeyword) return true
    if (target.kind === ts.SyntaxKind.FalseKeyword) return false
    if (target.kind === ts.SyntaxKind.NullKeyword) return null
    if (ts.isNumericLiteral(target)) return Number(target.text)
    if (ts.isStringLiteral(target) || ts.isNoSubstitutionTemplateLiteral(target)) return target.text
    if (ts.isIdentifier(target)) {
        if (target.text === "undefined") return undefined
        return environment.has(target.text) ? environment.get(target.text) : undefined
    }
    if (ts.isPrefixUnaryExpression(target) && target.operator === ts.SyntaxKind.ExclamationToken) {
        const inner = fold(target.operand, environment)
        if (inner === undefined && !environmentKnows(target.operand, environment)) return undefined
        return !inner
    }
    if (ts.isBinaryExpression(target)) {
        const left = fold(target.left, environment)
        const right = fold(target.right, environment)
        const kind = target.operatorToken.kind
        if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            if (left === false) return false
            if (left !== undefined && right !== undefined) return Boolean(left) && Boolean(right) ? right : false
            return undefined
        }
        if (kind === ts.SyntaxKind.BarBarToken) {
            if (left !== undefined && Boolean(left)) return left
            if (left !== undefined && right !== undefined) return right
            return undefined
        }
        if (left === undefined || right === undefined) return undefined
        switch (kind) {
            case ts.SyntaxKind.EqualsEqualsEqualsToken: return left === right
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: return left !== right
            case ts.SyntaxKind.EqualsEqualsToken: return left === right
            case ts.SyntaxKind.ExclamationEqualsToken: return left !== right
            case ts.SyntaxKind.LessThanToken: return (left as number) < (right as number)
            case ts.SyntaxKind.GreaterThanToken: return (left as number) > (right as number)
            case ts.SyntaxKind.LessThanEqualsToken: return (left as number) <= (right as number)
            case ts.SyntaxKind.GreaterThanEqualsToken: return (left as number) >= (right as number)
            default: return undefined
        }
    }
    return undefined
}

/** `!x` where x is a KNOWN false is constant; `!x` where x is unknown is not. Disambiguates `undefined`. */
function environmentKnows(node: ts.Expression, environment: ReadonlyMap<string, Constant>): boolean {
    const target = unwrap(node)
    if (ts.isIdentifier(target)) return environment.has(target.text)
    return fold(target, environment) !== undefined
}

// ---------------------------------------------------------------------------------------------
// structural helpers used by the detectors
// ---------------------------------------------------------------------------------------------

const ALWAYS_TRUE_WHEN_IDENTICAL = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanEqualsToken,
])

const NEVER_TRUE_WHEN_IDENTICAL = new Set([
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.LessThanToken,
])

/** Split at top-level `&&`, unwrapping parentheses. */
function conjuncts(expression: ts.Expression): ts.Expression[] {
    const target = unwrap(expression)
    if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        return [...conjuncts(target.left), ...conjuncts(target.right)]
    }
    return [target]
}

/** Split at top-level `||`, unwrapping parentheses. */
function disjuncts(expression: ts.Expression): ts.Expression[] {
    const target = unwrap(expression)
    if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        return [...disjuncts(target.left), ...disjuncts(target.right)]
    }
    return [target]
}

/** Non-builtin identifiers an expression reads, after inlining stable bindings. */
function observationRoots(
    source: ts.SourceFile,
    node: ts.Node,
    definitions: ReadonlyMap<string, Definition>,
    depth = 0,
    visiting: ReadonlySet<string> = new Set(),
): Set<string> {
    const roots = new Set<string>()
    if (depth > 6) return roots
    walk(node, (candidate) => {
        if (!ts.isIdentifier(candidate)) return
        const parent = candidate.parent
        // Only the base of a property chain is a root; `.status` is not.
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === candidate) return
        if (parent && ts.isPropertyAssignment(parent) && parent.name === candidate) return
        const name = candidate.text
        if (BUILTIN_ROOTS.has(name) || visiting.has(name)) return
        const definition = definitions.get(name)
        if (definition && definition.stable && definition.initializer) {
            const next = new Set(visiting)
            next.add(name)
            for (const inner of observationRoots(source, definition.initializer, definitions, depth + 1, next)) {
                roots.add(inner)
            }
            return
        }
        roots.add(name)
    })
    return roots
}

function isLengthAccess(node: ts.Expression): boolean {
    const target = unwrap(node)
    return ts.isPropertyAccessExpression(target) && target.name.text === "length"
}

/** `x.length >= 0`, `x.length > -1`, `x.length !== -1`, and their mirrors: true for every array. */
function lengthTautology(source: ts.SourceFile, node: ts.Expression): string | null {
    const target = unwrap(node)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    const numeric = (side: ts.Expression): number | null => {
        const value = fold(side, new Map())
        return typeof value === "number" ? value : null
    }
    const negative = (side: ts.Expression): number | null => {
        const inner = unwrap(side)
        if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken) {
            const value = numeric(inner.operand)
            return value === null ? null : -value
        }
        return numeric(inner)
    }
    if (isLengthAccess(target.left)) {
        const right = negative(target.right)
        if (right === null) return null
        if (kind === ts.SyntaxKind.GreaterThanEqualsToken && right <= 0) return `${textOf(source, target.left)} >= ${right}`
        if (kind === ts.SyntaxKind.GreaterThanToken && right < 0) return `${textOf(source, target.left)} > ${right}`
        if (
            (kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsToken)
            && right < 0
        ) return `${textOf(source, target.left)} !== ${right}`
        return null
    }
    if (isLengthAccess(target.right)) {
        const left = negative(target.left)
        if (left === null) return null
        if (kind === ts.SyntaxKind.LessThanEqualsToken && left <= 0) return `${left} <= ${textOf(source, target.right)}`
        if (kind === ts.SyntaxKind.LessThanToken && left < 0) return `${left} < ${textOf(source, target.right)}`
        return null
    }
    return null
}

/** `typeof x === typeof x`: two typeof operands over the same text. */
function typeofTautology(source: ts.SourceFile, node: ts.Expression): boolean {
    const target = unwrap(node)
    if (!ts.isBinaryExpression(target)) return false
    if (!ALWAYS_TRUE_WHEN_IDENTICAL.has(target.operatorToken.kind)) return false
    const left = unwrap(target.left)
    const right = unwrap(target.right)
    const isTypeof = (side: ts.Expression) =>
        ts.isTypeOfExpression(side)
    if (!isTypeof(left) || !isTypeof(right)) return false
    return normalize(source, left) === normalize(source, right)
}

/** `A || !A` and `!A || A` over the same operand text: true whatever A is. */
function excludedMiddle(source: ts.SourceFile, node: ts.Expression): string | null {
    const parts = disjuncts(node)
    if (parts.length < 2) return null
    const positives = new Map<string, string>()
    const negatives = new Map<string, string>()
    for (const part of parts) {
        const target = unwrap(part)
        if (ts.isPrefixUnaryExpression(target) && target.operator === ts.SyntaxKind.ExclamationToken) {
            negatives.set(normalize(source, target.operand), textOf(source, target.operand))
        } else {
            positives.set(normalize(source, target), textOf(source, target))
        }
    }
    for (const [key, text] of positives) if (negatives.has(key)) return text
    return null
}

// ---------------------------------------------------------------------------------------------
// falsifiability analysis: aliasing, frozen roots, local purity, loop accumulators, dominance
//
// Everything in this section answers one question the six original detectors never asked: could this
// condition have taken the value FALSE at all? A condition can be non-constant, read real observed
// values, pass every purity and provenance test above, and still be true on every run that reaches it,
// because the two things it compares are THE SAME THING reached by two routes, or because the code that
// would have falsified it cannot execute. These are the structural routes to that.
// ---------------------------------------------------------------------------------------------

/** `const { a } = obj`, `const { a: b } = obj`, `const [x, y] = pair`. Nested patterns are not followed. */
type DestructuredAlias = Readonly<{
    source: ts.Expression
    /** Property name for an object pattern, element index for an array pattern. */
    property: string | number
    sourceText: string
}>

/**
 * Destructured bindings, kept OUT of `definitions` on purpose.
 *
 * `buildDefinitions` only records `ts.isIdentifier(node.name)` declarations, so `const { total } = row`
 * leaves `total` a bare root: `canonical` cannot inline it and `observationRoots` treats it as its own
 * observation. Adding it to `definitions` would need a synthesised property-access node, which has no
 * source position, and `canonical`/`normalize` both call `getText`. So the alias is recorded separately
 * and read only by the detectors written for it, which keeps the blast radius on the six original
 * classes at exactly zero.
 */
function buildDestructuredAliases(source: ts.SourceFile): Map<string, DestructuredAlias> {
    const found: Array<readonly [string, DestructuredAlias]> = []
    walk(source, (node) => {
        if (!ts.isVariableDeclaration(node) || !node.initializer) return
        const initializer = node.initializer
        const sourceText = normalize(source, initializer)
        if (ts.isObjectBindingPattern(node.name)) {
            for (const element of node.name.elements) {
                if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue
                const property = element.propertyName && ts.isIdentifier(element.propertyName)
                    ? element.propertyName.text
                    : element.name.text
                found.push([element.name.text, { source: initializer, property, sourceText }])
            }
            return
        }
        if (ts.isArrayBindingPattern(node.name)) {
            node.name.elements.forEach((element, index) => {
                if (ts.isOmittedExpression(element)) return
                if (!ts.isIdentifier(element.name) || element.dotDotDotToken) return
                found.push([element.name.text, { source: initializer, property: index, sourceText }])
            })
        }
    })
    const seen = new Map<string, number>()
    for (const [name] of found) seen.set(name, (seen.get(name) ?? 0) + 1)
    const aliases = new Map<string, DestructuredAlias>()
    for (const [name, alias] of found) {
        // A name bound twice cannot be resolved without full scope analysis; drop it rather than
        // resolve it to the wrong binding. Same rule `buildDefinitions` applies.
        if ((seen.get(name) ?? 0) > 1) continue
        aliases.set(name, alias)
    }
    return aliases
}

/** The identifier a reference chain is rooted at: `a.b[c].d()` is rooted at `a`. */
function rootIdentifier(node: ts.Expression): string | null {
    let current = unwrap(node)
    for (let depth = 0; depth < 12; depth += 1) {
        if (ts.isIdentifier(current)) return current.text
        if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
            current = unwrap(current.expression)
            continue
        }
        if (ts.isCallExpression(current)) {
            current = unwrap(current.expression)
            continue
        }
        return null
    }
    return null
}

/**
 * Methods that change their receiver in place.
 *
 * `sort` and `reverse` are in `PURE_METHODS` and are NOT pure: both mutate. That set is used by the
 * existing self-comparison detector and changing it would move existing verdicts, so it is left alone
 * and the mutation is recorded here instead, where it decides whether a binding is frozen.
 */
const MUTATING_METHODS = new Set([
    "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin",
    "set", "delete", "add", "clear", "assign", "defineProperty", "setPrototypeOf",
])

/** Every name this file writes to, directly or through a property, an increment or a mutator call. */
function mutatedNames(source: ts.SourceFile): Set<string> {
    const mutated = new Set<string>()
    const note = (expression: ts.Expression | undefined): void => {
        if (!expression) return
        const root = rootIdentifier(expression)
        if (root) mutated.add(root)
    }
    walk(source, (node) => {
        if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) note(node.left)
        if (
            (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
            && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
        ) note(node.operand)
        if (ts.isDeleteExpression(node)) note(node.expression)
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            if (MUTATING_METHODS.has(node.expression.name.text)) note(node.expression.expression)
        }
    })
    return mutated
}

/**
 * Imported bindings this file cannot have changed, so reading one twice yields the same value.
 *
 * This is the whole difference between the two shapes the mirrored-derivation detector must tell apart.
 * `JSON.stringify(PERMISSION_KEYS)` written twice compares an imported production constant with itself
 * and can never fail. `table.rows.join(",")` written twice compares two OBSERVATIONS of a mutable
 * system taken at different times and is the strongest kind of assertion in this tree. Both canonicalise
 * to the same text and both are "pure"; only the provenance of the root separates them, so only an
 * import that this file never touches is ever treated as frozen.
 *
 * Handing a name to a function that is not provably pure counts as mutating it: the callee could hold a
 * reference and change it. That is conservative in the safe direction - it can only ever REMOVE a
 * finding.
 */
function buildFrozenRoots(source: ts.SourceFile, imported: ReadonlySet<string>, pureLocals: ReadonlySet<string>): Set<string> {
    const mutated = mutatedNames(source)
    walk(source, (node) => {
        if (!ts.isCallExpression(node)) return
        const callee = node.expression
        const pure = ts.isPropertyAccessExpression(callee)
            ? PURE_METHODS.has(callee.name.text)
            : ts.isIdentifier(callee) && (PURE_FUNCTIONS.has(callee.text) || pureLocals.has(callee.text))
        if (pure) return
        for (const argument of node.arguments) {
            const root = rootIdentifier(argument)
            if (root) mutated.add(root)
        }
    })
    return new Set([...imported].filter((name) => !mutated.has(name)))
}

/**
 * Locally declared functions provably side-effect free AND deterministic, computed to a fixed point.
 *
 * `isPure`/`deeplyPure` treat every call to a locally declared function as impure, which is right as a
 * default and is why `const a = summarise(rows); const b = summarise(rows); check(a === b)` is invisible
 * to every existing detector: the two sides canonicalise to the same text, but purity cannot be
 * established, so the self-comparison detector returns nothing at all. Proving the callee pure closes
 * that hole, and proving it is the only honest way to close it.
 *
 * A body qualifies when it contains no `await`, no `new`, no `delete`, no `yield`, writes nothing it did
 * not declare itself, calls nothing but a known-pure builtin or another function already proven pure,
 * and READS no free binding that this file assigns anywhere. The last condition is the one that keeps
 * a memoising or counting helper out: `(xs) => \`${xs.length}:${calls}\`` reads a mutable counter and is
 * therefore not a function whose two applications must agree.
 */
function buildPureLocals(source: ts.SourceFile): Set<string> {
    const candidates = new Map<string, FunctionLike>()
    walk(source, (node) => {
        const candidate = asFunctionLike(node)
        if (candidate && candidate.body) candidates.set(candidate.name, candidate)
    })
    const mutated = mutatedNames(source)
    const pure = new Set<string>()
    for (let round = 0; round < 8; round += 1) {
        let grew = false
        for (const [name, candidate] of candidates) {
            if (pure.has(name)) continue
            if (!functionBodyIsPure(candidate, pure, mutated)) continue
            pure.add(name)
            grew = true
        }
        if (!grew) break
    }
    return pure
}

function functionBodyIsPure(
    candidate: FunctionLike,
    pure: ReadonlySet<string>,
    mutated: ReadonlySet<string>,
): boolean {
    const body = candidate.body
    if (!body) return false
    const owned = new Set<string>()
    for (const parameter of candidate.parameters) {
        if (ts.isIdentifier(parameter.name)) owned.add(parameter.name.text)
    }
    walk(body, (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) owned.add(node.name.text)
        if (ts.isParameter(node) && ts.isIdentifier(node.name)) owned.add(node.name.text)
        if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) owned.add(node.name.text)
    })
    let ok = true
    walk(body, (node) => {
        if (!ok) return
        if (ts.isAwaitExpression(node) || ts.isNewExpression(node) || ts.isYieldExpression(node) || ts.isDeleteExpression(node)) {
            ok = false
            return
        }
        if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) {
            const root = rootIdentifier(node.left)
            if (!root || !owned.has(root)) ok = false
            return
        }
        if (
            (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
            && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
            const root = rootIdentifier(node.operand)
            if (!root || !owned.has(root)) ok = false
            return
        }
        if (ts.isCallExpression(node)) {
            if (ts.isPropertyAccessExpression(node.expression)) {
                if (!PURE_METHODS.has(node.expression.name.text)) ok = false
                return
            }
            if (ts.isIdentifier(node.expression)) {
                const callee = node.expression.text
                if (!PURE_FUNCTIONS.has(callee) && !pure.has(callee) && callee !== candidate.name) ok = false
                return
            }
            ok = false
            return
        }
        if (!ts.isIdentifier(node)) return
        const parent = node.parent
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) return
        if (parent && ts.isPropertyAssignment(parent) && parent.name === node) return
        if (owned.has(node.text) || BUILTIN_ROOTS.has(node.text)) return
        // A free binding that something in this file writes to makes two applications of this
        // function able to disagree, which is exactly what the detector must not assume away.
        if (mutated.has(node.text)) ok = false
    })
    return ok
}

/** `impureNode`, but a call to a function proven pure by `buildPureLocals` no longer counts. */
function impureNodeWith(candidate: ts.Node, pureLocals: ReadonlySet<string>): boolean {
    if (
        ts.isCallExpression(candidate)
        && ts.isIdentifier(candidate.expression)
        && pureLocals.has(candidate.expression.text)
    ) return false
    return impureNode(candidate)
}

/** `deeplyPure`, extended with the locally proven pure functions. */
function deeplyPureWith(
    context: Context,
    node: ts.Node,
    depth = 0,
    visiting: ReadonlySet<string> = new Set(),
): boolean {
    if (depth > 6) return false
    let pure = true
    walk(node, (candidate) => {
        if (!pure) return
        if (impureNodeWith(candidate, context.pureLocals)) {
            pure = false
            return
        }
        if (!ts.isIdentifier(candidate)) return
        const parent = candidate.parent
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === candidate) return
        if (parent && ts.isPropertyAssignment(parent) && parent.name === candidate) return
        if (visiting.has(candidate.text)) return
        const definition = context.definitions.get(candidate.text)
        if (!definition || !definition.stable || !definition.initializer) return
        const next = new Set(visiting)
        next.add(candidate.text)
        if (!deeplyPureWith(context, definition.initializer, depth + 1, next)) pure = false
    })
    return pure
}

/**
 * WHERE a value was produced, following alias-only steps.
 *
 * The point of a `key` rather than a text is that two names reaching the SAME key denote ONE
 * evaluation, and one evaluation compared with itself cannot differ - no purity argument, no
 * immutability argument, nothing left to assume. `const a = x; const b = x; check(a === b)` where `x`
 * is a stable binding is unfalsifiable for that reason and for no other. Two names reaching two
 * DIFFERENT keys are two evaluations, which is the honest shape (`const before = read(); const after =
 * read()`), and this function is what keeps those two apart.
 */
type Identity = Readonly<{ key: string; site: ts.Node; via: readonly string[] }>

function identityOf(context: Context, node: ts.Expression, depth = 0): Identity | null {
    if (depth > 8) return null
    const target = unwrap(node)
    if (ts.isIdentifier(target)) {
        const alias = context.destructured.get(target.text)
        if (alias) {
            const inner = propertyIdentity(context, alias.source, alias.property, depth + 1)
            if (!inner) return null
            return {
                ...inner,
                via: [`\`${target.text}\` destructured from \`${oneLine(alias.sourceText, 60)}\``, ...inner.via],
            }
        }
        const definition = context.definitions.get(target.text)
        if (!definition || !definition.stable) return null
        if (!definition.initializer) return { key: `binding:${target.text}`, site: target, via: [] }
        const step = `\`${target.text}\` = \`${oneLine(textOf(context.source, definition.initializer), 60)}\``
        const inner = identityOf(context, definition.initializer, depth + 1)
        if (inner) return { ...inner, via: [step, ...inner.via] }
        return {
            key: `site:${definition.initializer.getStart(context.source)}`,
            site: definition.initializer,
            via: [step],
        }
    }
    if (ts.isPropertyAccessExpression(target)) {
        return propertyIdentity(context, target.expression, target.name.text, depth + 1)
    }
    if (ts.isElementAccessExpression(target)) {
        const index = fold(target.argumentExpression, new Map())
        if (typeof index !== "number") return null
        return propertyIdentity(context, target.expression, index, depth + 1)
    }
    return null
}

/** The identity of one property of an object/array literal this file builds. */
function propertyIdentity(
    context: Context,
    receiver: ts.Expression,
    property: string | number,
    depth: number,
): Identity | null {
    if (depth > 8) return null
    const resolved = resolveToExpression(context, receiver, depth)
    if (!resolved) return null
    if (ts.isObjectLiteralExpression(resolved) && typeof property === "string") {
        for (const member of resolved.properties) {
            if (ts.isPropertyAssignment(member) && ts.isIdentifier(member.name) && member.name.text === property) {
                return identityOf(context, member.initializer, depth + 1) ?? {
                    key: `site:${member.initializer.getStart(context.source)}`,
                    site: member.initializer,
                    via: [],
                }
            }
            if (ts.isShorthandPropertyAssignment(member) && member.name.text === property) {
                return identityOf(context, member.name, depth + 1)
            }
        }
        return null
    }
    if (ts.isArrayLiteralExpression(resolved) && typeof property === "number") {
        const element = resolved.elements[property]
        if (!element || ts.isSpreadElement(element)) return null
        return identityOf(context, element, depth + 1) ?? {
            key: `site:${element.getStart(context.source)}`,
            site: element,
            via: [],
        }
    }
    return null
}

/**
 * Nothing that executes between two evaluation sites could have changed what the second one reads.
 *
 * This is the condition that stops the mirrored-derivation detector from calling a real before/after
 * measurement vacuous. Two reads of a frozen import with an unproven call between them might genuinely
 * differ - the call is exactly the thing under test - so the finding is only made when the gap between
 * the two sites contains no assignment, no `await`, and no call this scanner cannot prove pure.
 */
function noInterveningEffect(context: Context, left: ts.Node, right: ts.Node): boolean {
    const leftFirst = left.getStart(context.source) <= right.getStart(context.source)
    const first = leftFirst ? left : right
    const second = leftFirst ? right : left
    const from = first.getEnd()
    const to = second.getStart(context.source)
    if (to <= from) return true
    let clean = true
    walk(context.source, (node) => {
        if (!clean) return
        if (node.getStart(context.source) < from || node.getEnd() > to) return
        if (impureNodeWith(node, context.pureLocals)) clean = false
    })
    return clean
}

/** A binding accumulated inside a loop, with the collection whose emptiness decides the iteration count. */
type LoopAccumulator = Readonly<{
    loop: ts.Node
    /** The iterated collection, or null when the loop's trip count cannot be read off its head. */
    iterable: ts.Expression | null
    line: number
    /** A write to the binding OUTSIDE every loop: the value moves whatever the collection holds. */
    escapes: boolean
}>

/** Loop-ish nodes, plus the `forEach` callback shape, with the collection each iterates. */
function loopIterable(node: ts.Node): { loop: ts.Node; iterable: ts.Expression | null } | null {
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) return { loop: node, iterable: node.expression }
    if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return { loop: node, iterable: null }
    if (ts.isForStatement(node)) {
        // `for (let i = 0; i < rows.length; i += 1)` is a loop over `rows` as far as emptiness goes.
        const condition = node.condition ? unwrap(node.condition) : null
        if (
            condition
            && ts.isBinaryExpression(condition)
            && (condition.operatorToken.kind === ts.SyntaxKind.LessThanToken
                || condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken)
            && isLengthAccess(condition.right)
        ) {
            return { loop: node, iterable: (unwrap(condition.right) as ts.PropertyAccessExpression).expression }
        }
        return { loop: node, iterable: null }
    }
    if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && (node.expression.name.text === "forEach" || node.expression.name.text === "map")
    ) return { loop: node, iterable: node.expression.expression }
    return null
}

/**
 * Bindings written only inside a loop body, with the collection that decides whether the body runs.
 *
 * The replay shape this exists for: `let running = 0; for (const row of rows) running += row.delta`
 * followed by an assertion about `running`. On an empty `rows` the loop never runs, `running` is still
 * its initialiser, and the assertion compares initial values - it reports that a replay reproduced every
 * stored balance without replaying one. The OUTERMOST enclosing loop is recorded, because that is the
 * one whose emptiness decides whether anything happens at all.
 */
function buildLoopAccumulators(source: ts.SourceFile): Map<string, LoopAccumulator> {
    const writes = new Map<string, ts.Node[]>()
    const note = (expression: ts.Expression, node: ts.Node): void => {
        const target = unwrap(expression)
        if (!ts.isIdentifier(target)) return
        const list = writes.get(target.text) ?? []
        list.push(node)
        writes.set(target.text, list)
    }
    walk(source, (node) => {
        if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) note(node.left, node)
        if (
            (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
            && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
        ) note(node.operand, node)
    })
    const accumulators = new Map<string, LoopAccumulator>()
    for (const [name, nodes] of writes) {
        let outermost: { loop: ts.Node; iterable: ts.Expression | null } | null = null
        let escapes = false
        for (const node of nodes) {
            let enclosing: { loop: ts.Node; iterable: ts.Expression | null } | null = null
            for (let current: ts.Node | undefined = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
                const candidate = loopIterable(current)
                if (candidate) enclosing = candidate
            }
            if (!enclosing) {
                escapes = true
                continue
            }
            if (!outermost) outermost = enclosing
        }
        if (!outermost) continue
        accumulators.set(name, {
            loop: outermost.loop,
            iterable: outermost.iterable,
            line: lineOf(source, outermost.loop),
            escapes,
        })
    }
    return accumulators
}

// ---- dominance: which conditions must hold for an assertion to PASS -------------------------

/**
 * The expressions that must be true for `assertion` to pass, at the granularity a length pin can be
 * read off: the top-level conjuncts of its own condition, and the conjuncts of every enclosing `if`.
 *
 * WHY THIS REPLACED A WALK. `hasNonEmptyGuard` searched the whole condition for a pin ANYWHERE in it,
 * which accepts three positions that do not protect anything. A pin under `||` (`rows.length > 0 ||
 * rows.every(p)`) does not: on an empty collection the first disjunct is false, the second is true, and
 * the assertion passes. A pin inside the `every` callback does not: it runs per element, and on zero
 * elements it never runs. A pin inside any other nested function does not: nothing calls it. Requiring
 * the pin to BE a conjunct - not merely to appear inside one - removes all three at once, and is why
 * `&&` order does not matter: both operands of `&&` must hold for the assertion to pass, so a pin in
 * either position protects it.
 */
function pinScopes(condition: ts.Expression, assertion: ts.CallExpression): ts.Expression[] {
    const scopes: ts.Expression[] = [...conjuncts(condition)]
    for (const guard of guardsOf(assertion)) {
        // A synthesised `!expr` from an else-branch has no source position; `normalize` would throw.
        if (guard.pos < 0) continue
        scopes.push(...conjuncts(guard))
    }
    return scopes.filter((scope) => scope.pos >= 0)
}

/** Transformations that cannot change a collection's length, so a pin on the source carries. */
const LENGTH_PRESERVING_METHODS = new Set(["map", "sort", "reverse"])

/**
 * Texts denoting a collection whose length is the same as `receiver`'s.
 *
 * `const view = rows.map(f)` gives `view` exactly `rows.length` elements, so `rows.length > 0 &&
 * view.every(p)` is a guarded assertion, and reporting it would be a false positive of exactly the kind
 * that gets a scanner switched off. `filter`, and `slice` with arguments, are deliberately NOT here:
 * they can empty a non-empty collection, so a pin on their source does not carry - which is what keeps
 * `items.slice(items.length - undated.length).every(...)` and `levels.slice(1).every(...)` reported.
 */
function receiverEquivalents(context: Context, receiver: ts.Expression): Set<string> {
    const keys = new Set<string>()
    let current = unwrap(receiver)
    for (let depth = 0; depth < 8; depth += 1) {
        keys.add(normalize(context.source, current))
        if (ts.isIdentifier(current)) {
            const definition = context.definitions.get(current.text)
            if (!definition || !definition.stable || !definition.initializer) break
            current = unwrap(definition.initializer)
            continue
        }
        if (ts.isArrayLiteralExpression(current) && current.elements.length === 1) {
            const only = current.elements[0]
            if (!ts.isSpreadElement(only)) break
            current = unwrap(only.expression)
            continue
        }
        if (!ts.isCallExpression(current) || !ts.isPropertyAccessExpression(current.expression)) break
        const method = current.expression.name.text
        const preserving = LENGTH_PRESERVING_METHODS.has(method)
            || ((method === "slice" || method === "concat" || method === "flat") && current.arguments.length === 0)
        if (!preserving) break
        const next = unwrap(current.expression.expression)
        // `Object.values(x)` and friends are not a transformation OF `Object`.
        if (ts.isIdentifier(next) && BUILTIN_ROOTS.has(next.text)) break
        current = next
    }
    return keys
}

/** Does this expression, on its own, force one of `receivers` to hold at least one element? */
function pinsNonEmpty(context: Context, pin: ts.Expression, receivers: ReadonlySet<string>): boolean {
    const target = unwrap(pin)
    // `unwrap` BOTH the `.length` node and the collection it reads. `receiverEquivalents` walks an
    // unwrapped chain, so a pin written `(installation.history as Array<T>).length > 0` has to lose its
    // parentheses and its `as` clause before its text can meet `installation.history`. Without this the
    // pin and the receiver are the same expression spelled two ways, and a guarded assertion three
    // lines from a real one gets reported - which is precisely the false positive that discredits a
    // scanner. MEASURED: check-blueprint-install-routes.ts:262 is guarded by exactly that spelling.
    const matches = (side: ts.Expression): boolean =>
        isLengthAccess(side)
        && receivers.has(normalize(context.source, unwrap((unwrap(side) as ts.PropertyAccessExpression).expression)))
    // `rows.length && rows.every(p)`: a bare length in boolean position is a pin.
    if (matches(target)) return true
    if (!ts.isBinaryExpression(target)) return false
    const kind = target.operatorToken.kind
    const left = unwrap(target.left)
    const right = unwrap(target.right)
    const leftValue = fold(left, new Map())
    const rightValue = fold(right, new Map())
    if (matches(left) && typeof rightValue === "number") {
        if (kind === ts.SyntaxKind.GreaterThanToken && rightValue >= 0) return true
        if (kind === ts.SyntaxKind.GreaterThanEqualsToken && rightValue >= 1) return true
        if (
            (kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.EqualsEqualsToken)
            && rightValue >= 1
        ) return true
        if (
            (kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsToken)
            && rightValue === 0
        ) return true
    }
    if (matches(right) && typeof leftValue === "number") {
        if (kind === ts.SyntaxKind.LessThanToken && leftValue >= 0) return true
        if (kind === ts.SyntaxKind.LessThanEqualsToken && leftValue >= 1) return true
        if (
            (kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.EqualsEqualsToken)
            && leftValue >= 1
        ) return true
        if (
            (kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsToken)
            && leftValue === 0
        ) return true
    }
    return false
}

/** Is the collection this loop iterates pinned non-empty by the assertion that reads its accumulator? */
function iterablePinned(
    context: Context,
    iterable: ts.Expression,
    whole: ts.Expression,
    assertion: ts.CallExpression,
): boolean {
    if (provablyNonEmpty(context, iterable)) return true
    const receivers = receiverEquivalents(context, iterable)
    return pinScopes(whole, assertion).some((pin) => pinsNonEmpty(context, pin, receivers))
}

// ---- the decidable comparison fragment, for conjunct domination -----------------------------

const COMPARISON_KINDS = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
])

/** `<subject> <op> <constant>`, normalised so the subject is always on the left. */
type Bound = Readonly<{ subject: string; kind: ts.SyntaxKind; value: Constant; text: string }>

function mirrorComparison(kind: ts.SyntaxKind): ts.SyntaxKind {
    if (kind === ts.SyntaxKind.LessThanToken) return ts.SyntaxKind.GreaterThanToken
    if (kind === ts.SyntaxKind.GreaterThanToken) return ts.SyntaxKind.LessThanToken
    if (kind === ts.SyntaxKind.LessThanEqualsToken) return ts.SyntaxKind.GreaterThanEqualsToken
    if (kind === ts.SyntaxKind.GreaterThanEqualsToken) return ts.SyntaxKind.LessThanEqualsToken
    return kind
}

function asBound(context: Context, expression: ts.Expression): Bound | null {
    const target = unwrap(expression)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    if (!COMPARISON_KINDS.has(kind)) return null
    const leftValue = fold(target.left, new Map())
    const rightValue = fold(target.right, new Map())
    const text = oneLine(textOf(context.source, target), 70)
    if (rightValue !== undefined && leftValue === undefined) {
        return { subject: normalize(context.source, target.left), kind, value: rightValue, text }
    }
    if (leftValue !== undefined && rightValue === undefined) {
        return { subject: normalize(context.source, target.right), kind: mirrorComparison(kind), value: leftValue, text }
    }
    return null
}

function boundHolds(bound: Bound, value: Constant): boolean {
    switch (bound.kind) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken: return value === bound.value
        case ts.SyntaxKind.EqualsEqualsToken: return value === bound.value
        case ts.SyntaxKind.ExclamationEqualsEqualsToken: return value !== bound.value
        case ts.SyntaxKind.ExclamationEqualsToken: return value !== bound.value
        case ts.SyntaxKind.LessThanToken: return (value as number) < (bound.value as number)
        case ts.SyntaxKind.GreaterThanToken: return (value as number) > (bound.value as number)
        case ts.SyntaxKind.LessThanEqualsToken: return (value as number) <= (bound.value as number)
        case ts.SyntaxKind.GreaterThanEqualsToken: return (value as number) >= (bound.value as number)
        default: return false
    }
}

/**
 * Does `premise` force `claim` to be true, over the same subject?
 *
 * Decided by exhaustion over a SUFFICIENT sample rather than by a table of operator pairs, because a
 * table is where an unsound row hides. For one variable compared against constants, the critical points
 * are the constants themselves, a point either side of each, a midpoint either side (so `x > 0` is not
 * mistaken for `x >= 1` when the subject is not an integer), and the two extremes. A claim that holds at
 * every sampled point where the premise holds, with at least one such point, is entailed.
 */
function boundEntails(premise: Bound, claim: Bound): boolean {
    if (premise.subject !== claim.subject) return false
    const numeric = typeof premise.value === "number" && typeof claim.value === "number"
    if (!numeric) {
        // Only equality reasoning is sound for non-numbers here.
        const ordered = new Set([
            ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken,
            ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken,
        ])
        if (ordered.has(premise.kind) || ordered.has(claim.kind)) return false
    }
    const candidates: Constant[] = numeric
        ? [premise.value as number, claim.value as number].flatMap((value) => [
            value - 1, value - 0.5, value, value + 0.5, value + 1,
        ]).concat([-1e9, 1e9])
        : [premise.value, claim.value, "\u0000neither-of-the-two"]
    let witnesses = 0
    for (const candidate of candidates) {
        if (!boundHolds(premise, candidate)) continue
        witnesses += 1
        if (!boundHolds(claim, candidate)) return false
    }
    return witnesses > 0
}



// ---------------------------------------------------------------------------------------------
// class detectors
// ---------------------------------------------------------------------------------------------

type Verdict = Readonly<{ classification: Classification; evidence: string }> | null

type Context = Readonly<{
    file: string
    source: ts.SourceFile
    definitions: ReadonlyMap<string, Definition>
    facts: readonly FieldFact[]
    assertions: readonly ts.CallExpression[]
    helpers: ReadonlyMap<string, number>
    imported: ReadonlySet<string>
    /** `const { a } = obj` / `const [x] = pair` bindings, which `definitions` deliberately does not hold. */
    destructured: ReadonlyMap<string, DestructuredAlias>
    /** Imported bindings this file never mutates: reading one twice gives the same value. */
    frozen: ReadonlySet<string>
    /** Locally declared functions provable side-effect free, so two applications agree. */
    pureLocals: ReadonlySet<string>
    /** Bindings accumulated inside a loop, with the iterable whose emptiness decides the count. */
    accumulators: ReadonlyMap<string, LoopAccumulator>
}>

/** Class: the condition, or this conjunct of it, folds to a constant true. */
function detectLiteral(context: Context, conjunct: ts.Expression, assertion: ts.CallExpression): Verdict {
    const value = fold(conjunct, new Map())
    if (value === undefined) return null
    if (!value) {
        // An unconditional FALSE is the opposite defect - an assertion that cannot PASS. In this
        // repository every instance is a deliberate failure marker on an error path: `if (r.seedFailed)
        // return check(name, false, ...)`, or a line after a `throw` that must never be reached. Both
        // are legitimately non-live, and both carry their own evidence.
        const guards = guardsOf(assertion).map((guard) => guardText(context.source, guard)).filter(Boolean)
        const deliberate = fixtureEvidence(context, assertion)
        if (guards.length > 0 || deliberate) {
            return {
                classification: "INTENTIONAL_FIXTURE_SELF_CHECK",
                evidence: `Folds to the constant false, so it can never PASS - a deliberate failure marker rather than an assertion about behaviour. Evidence: ${guards.length > 0 ? `it is reached only under \`${oneLine(guards.join(" && "), 90)}\`, an error path` : ""}${guards.length > 0 && deliberate ? "; " : ""}${deliberate ?? ""}.`,
            }
        }
        return {
            classification: "UNRESOLVED",
            evidence: `Folds to the constant ${JSON.stringify(value)}, so this can never be TRUE. That is the opposite defect - an assertion that cannot PASS - and is outside the vacuity classes, so it is reported rather than counted. Nothing marks it as a deliberate failure marker, so a human should look.`,
        }
    }
    return {
        classification: "VACUOUS_LITERAL",
        evidence: `Folds to the constant ${JSON.stringify(value)} with no reference to any observed value, so it is true on every run.`,
    }
}

/** Class: always true by shape - length bounds, typeof against itself, excluded middle. */
function detectTautology(context: Context, conjunct: ts.Expression): Verdict {
    const length = lengthTautology(context.source, conjunct)
    if (length) {
        return {
            classification: "VACUOUS_TAUTOLOGY",
            evidence: `\`${length}\` holds for every array and every string, including the empty one, so no observation can make it false.`,
        }
    }
    if (typeofTautology(context.source, conjunct)) {
        return {
            classification: "VACUOUS_TAUTOLOGY",
            evidence: "Both operands are the same `typeof` expression, so the comparison is true whatever the value's type is.",
        }
    }
    const middle = excludedMiddle(context.source, conjunct)
    if (middle) {
        return {
            classification: "VACUOUS_TAUTOLOGY",
            evidence: `The disjunction contains both \`${oneLine(middle)}\` and its negation, so it is true by excluded middle.`,
        }
    }
    return null
}

/**
 * Class 2: both sides of the comparison are the same expression, either literally or after the
 * factory that built one of them is taken into account.
 *
 * Three tiers, and only the first two are counted as defects:
 *   1. the operands are textually identical and PURE - unambiguously `x === x`;
 *   2. they become identical once a field-provenance fact from this file is applied, and both are
 *      pure - this is root's defect 2, where `ok.body` IS `JSON.parse(ok.raw)`;
 *   3. they become identical only after two DIFFERENT local bindings are inlined. That is a
 *      suspicion, not a proof: two bindings of the same pure text are usually two observations of a
 *      mutable system taken at different times, which is a real assertion. Reported UNRESOLVED.
 */
function detectSelfComparison(context: Context, conjunct: ts.Expression): Verdict {
    const target = unwrap(conjunct)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    const always = ALWAYS_TRUE_WHEN_IDENTICAL.has(kind)
    const never = NEVER_TRUE_WHEN_IDENTICAL.has(kind)
    if (!always && !never) return null

    const leftPlain = normalize(context.source, target.left)
    const rightPlain = normalize(context.source, target.right)
    const operandsPure = isPure(target.left) && isPure(target.right)

    let matched: string | null = null
    let factNote = ""

    if (operandsPure && leftPlain === rightPlain) {
        matched = "the two operands are textually identical, and contain no call that could return a different value on a second evaluation"
    }
    if (!matched && operandsPure) {
        for (const fact of context.facts) {
            const left = applyFieldFact(leftPlain, fact)
            const right = applyFieldFact(rightPlain, fact)
            if (left !== right) continue
            // Substituting only makes both sides equal when the OTHER side already performs the same
            // derivation, which is what makes this sound rather than a guess.
            matched = `the two operands are identical once \`.${fact.field}\` is resolved to the derivation the factory at line ${fact.line} gives it (\`${fact.template.replace(/\u0000R/gu, "<receiver>")}\`)`
            if (fact.alternatives > 1) {
                factNote = ` The field has ${fact.alternatives} assignment(s); an alternative is only reached when that same derivation throws, in which case the identical derivation on the other side of this comparison throws too, so on every run where this assertion is evaluated at all both sides are the same value.`
            }
            break
        }
    }

    if (!matched) {
        // Tier 3.
        const leftCanonical = canonical(context.source, target.left, context.definitions)
        const rightCanonical = canonical(context.source, target.right, context.definitions)
        if (leftCanonical !== rightCanonical) return null
        // Purity must be judged on the INLINED form. Two pure property reads whose bindings each came
        // from their own `await service.call(...)` are two real observations, not `x === x`.
        if (!deeplyPure(target.left, context.definitions) || !deeplyPure(target.right, context.definitions)) return null
        return {
            classification: "UNRESOLVED",
            evidence: `\`${oneLine(textOf(context.source, target.left))}\` and \`${oneLine(textOf(context.source, target.right))}\` are different names that resolve, through side-effect-free bindings only, to the same expression text (\`${oneLine(leftCanonical, 90)}\`), which LOOKS like x === x. Not counted: deciding whether the underlying value could have moved between the two reads needs the runtime, not the source text. Worth a human read.`,
        }
    }

    if (never) {
        return {
            classification: "UNRESOLVED",
            evidence: `${matched}, under an operator that is FALSE for identical operands, so this can never pass. That is the opposite defect and is outside the vacuity classes.${factNote}`,
        }
    }
    return {
        classification: "VACUOUS_SELF_COMPARISON",
        evidence: `x ${target.operatorToken.getText()} x: ${matched}, so the comparison cannot be false.${factNote}`,
    }
}

/**
 * Class 3: the expected value is computed FROM the observation being checked, by branching on it.
 *
 * The mechanism that makes this unfalsifiable is the BRANCH: if the observation regresses, the
 * expectation moves with it. So a shared root alone is not enough - `row.a === row.b` shares a root
 * and is a real invariant. The signature required here is one operand that resolves to a branch
 * whose TEST reads the same observation the other operand reads, with constant branch results.
 */
function detectDerivedExpectation(context: Context, conjunct: ts.Expression): Verdict {
    const target = unwrap(conjunct)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    const comparison = kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        || kind === ts.SyntaxKind.EqualsEqualsToken
        || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
        || kind === ts.SyntaxKind.ExclamationEqualsToken
    if (!comparison) return null

    const sides: Array<[ts.Expression, ts.Expression]> = [[target.left, target.right], [target.right, target.left]]
    for (const [expectation, observation] of sides) {
        const observed = observationRoots(context.source, observation, context.definitions)
        if (observed.size === 0) continue

        // Form A: the expectation is (or resolves to) a ternary branching on the observation.
        const resolved = resolveToExpression(context, expectation)
        if (resolved && ts.isConditionalExpression(resolved)) {
            const testRoots = observationRoots(context.source, resolved.condition, context.definitions)
            const shared = [...testRoots].filter((root) => observed.has(root))
            const branchesConstant = fold(resolved.whenTrue, new Map()) !== undefined
                && fold(resolved.whenFalse, new Map()) !== undefined
            if (shared.length > 0 && branchesConstant) {
                return {
                    classification: "VACUOUS_DERIVED_EXPECTATION",
                    evidence: `The expected value \`${oneLine(textOf(context.source, expectation))}\` is a branch on \`${oneLine(textOf(context.source, resolved.condition))}\`, which reads the same observation as \`${oneLine(textOf(context.source, observation))}\` (shared root${shared.length > 1 ? "s" : ""}: \`${shared.slice(0, 3).join(", ")}\`${shared.length > 3 ? ` and ${shared.length - 3} more` : ""}). If the observation regresses the expectation moves with it, so the comparison stays true.`,
                }
            }
        }

        // Form B: the expectation is a `let` whose assignments are guarded by the observation.
        const plain = unwrap(expectation)
        if (ts.isIdentifier(plain)) {
            const definition = context.definitions.get(plain.text)
            if (definition && definition.assignments.length > 0) {
                for (const assignment of definition.assignments) {
                    for (const guard of guardsOf(assignment)) {
                        const guardRoots = observationRoots(context.source, guard, context.definitions)
                        const shared = [...guardRoots].filter((root) => observed.has(root))
                        if (shared.length === 0) continue
                        return {
                            classification: "VACUOUS_DERIVED_EXPECTATION",
                            evidence: `The expected value \`${plain.text}\` is assigned at line ${lineOf(context.source, assignment)} under the guard \`${oneLine(textOf(context.source, guard))}\`, which reads the same observation (\`${shared.join(", ")}\`) that \`${oneLine(textOf(context.source, observation))}\` reads, so the expectation follows the observation instead of pinning it.`,
                        }
                    }
                }
            }
        }
    }
    return null
}

/** The expression a name ultimately stands for, if it is a stable single-assignment binding. */
function resolveToExpression(context: Context, node: ts.Expression, depth = 0): ts.Expression | null {
    const target = unwrap(node)
    if (depth > 6) return target
    if (!ts.isIdentifier(target)) return target
    const definition = context.definitions.get(target.text)
    if (!definition || !definition.stable || !definition.initializer) return null
    return resolveToExpression(context, definition.initializer, depth + 1)
}

/** Conditions that must hold for a node to execute, walking out to the enclosing function. */
function guardsOf(node: ts.Node): ts.Expression[] {
    const guards: ts.Expression[] = []
    let child: ts.Node = node
    let current: ts.Node | undefined = node.parent
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
        if (ts.isIfStatement(current) && current.thenStatement === child) guards.push(current.expression)
        if (ts.isIfStatement(current) && current.elseStatement === child) {
            guards.push(ts.factory.createLogicalNot(current.expression))
        }
        if (ts.isConditionalExpression(current) && (current.whenTrue === child || current.whenFalse === child)) {
            guards.push(current.condition)
        }
        if (
            ts.isBinaryExpression(current)
            && (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
                || current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
            && current.right === child
        ) guards.push(current.left)
        child = current
        current = current.parent
    }
    return guards
}

/** Textual guard descriptions, using the original source where the node has one. */
function guardText(source: ts.SourceFile, guard: ts.Expression): string {
    try {
        return normalize(source, guard)
    } catch {
        // A synthesised `!expr` from an else-branch has no source position.
        return ""
    }
}

/**
 * Class 1: a variable whose only assignments are guarded, where the assertion itself forces the
 * guard to the value that SKIPS the assignment, so the variable still holds its initialiser.
 *
 * Only this airtight form is counted. A conditionally assigned variable with no in-assertion
 * constraint on its guard is suspicious but not provably vacuous, so it goes to UNRESOLVED.
 */
function detectConditionalInit(context: Context, conjunct: ts.Expression, siblings: readonly ts.Expression[]): Verdict {
    const names = new Set<string>()
    walk(conjunct, (candidate) => {
        if (ts.isIdentifier(candidate)) names.add(candidate.text)
    })
    for (const name of names) {
        const definition = context.definitions.get(name)
        if (!definition || !definition.initializer || definition.assignments.length === 0) continue
        const initial = fold(definition.initializer, new Map())
        if (initial === undefined && definition.initializer.kind !== ts.SyntaxKind.NullKeyword) continue

        // Every assignment must be guarded; an unconditional one means the variable really moves.
        const guardSets = definition.assignments.map((assignment) => guardsOf(assignment))
        if (guardSets.some((guards) => guards.length === 0)) continue

        const environment = new Map<string, Constant>([[name, initial]])
        const withInitial = fold(conjunct, environment)
        if (withInitial === undefined || !withInitial) continue

        const siblingTexts = siblings
            .filter((sibling) => sibling !== conjunct)
            .map((sibling) => ({ text: guardText(context.source, sibling), node: sibling }))

        const forcedFalse = (guard: ts.Expression): { node: ts.Expression } | null => {
            const guardKey = guardText(context.source, guard)
            if (!guardKey) return null
            for (const sibling of siblingTexts) {
                if (sibling.text === `!${guardKey}` || sibling.text === `!(${guardKey})`) return { node: sibling.node }
                if (guardKey === `!${sibling.text}` || guardKey === `!(${sibling.text})`) return { node: sibling.node }
            }
            return null
        }
        const forcedTrue = (guard: ts.Expression): boolean => {
            const guardKey = guardText(context.source, guard)
            if (!guardKey) return false
            return siblingTexts.some((sibling) => sibling.text === guardKey)
        }

        // Vacuous only if EVERY assignment is provably skipped: an assignment needs all of its guards
        // true, so one guard forced false by a sibling conjunct is enough to skip that assignment.
        const skipped = definition.assignments.map((assignment, position) => {
            for (const guard of guardSets[position]) {
                const pin = forcedFalse(guard)
                if (pin) return { assignment, guard, pin: pin.node }
            }
            return null
        })
        if (skipped.every((entry) => entry !== null)) {
            const first = skipped[0] as { assignment: ts.BinaryExpression; guard: ts.Expression; pin: ts.Expression }
            return {
                classification: "VACUOUS_CONDITIONAL_INIT",
                evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)}, and all ${definition.assignments.length} assignment(s) to it are skipped on any run where this assertion passes: the assignment at line ${lineOf(context.source, first.assignment)} needs \`${oneLine(textOf(context.source, first.guard))}\`, while the sibling conjunct \`${oneLine(textOf(context.source, first.pin))}\` of this same condition forces that guard to the value which SKIPS it. So \`${name}\` still holds its initialiser and this conjunct is \`${oneLine(textOf(context.source, conjunct))}\` = true. It measures nothing.`,
            }
        }

        // An assignment whose every guard is forced TRUE by a sibling definitely runs, so the
        // variable moves and this conjunct is live. Say so rather than raising a false suspicion.
        const definitelyRuns = guardSets.some((guards) => guards.length > 0 && guards.every(forcedTrue))
        if (definitelyRuns) return null
        return {
            classification: "UNRESOLVED",
            evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)} and every assignment to it is conditional (guard: \`${oneLine(guardSets.flat().map((guard) => textOf(context.source, guard)).join(" ; "))}\`), and with the initialiser this conjunct is TRUE. It is only provably vacuous if the guard is false whenever the assertion passes, and nothing in this condition pins it, so this is a suspicion rather than a counted defect.`,
        }
    }
    return null
}

/**
 * Class: `arr.every(...)` with nothing establishing that `arr` is non-empty. `[].every` is true.
 *
 * The DOMINANCE RULE (mutation key `EVERY_DOMINANCE`) decides what counts as "establishing". With it
 * enabled a pin must BE a conjunct of this assertion's own condition or of an enclosing `if`, and it
 * may name any collection of provably the same length as the receiver (`pinScopes`, `pinsNonEmpty`,
 * `receiverEquivalents`). With it disabled the detector falls back to the original walk, which accepted
 * a pin ANYWHERE inside the condition. That fallback accepts three positions that protect nothing:
 *   - under `||`: on an empty collection `rows.length > 0 || rows.every(p)` has a false first disjunct
 *     and a true second one, so the assertion passes;
 *   - inside the `every` callback: it runs per element, so on zero elements it never runs at all;
 *   - inside any other nested function: nothing calls it.
 * It also REFUSES a pin that is sound - one on `rows` protecting `rows.map(f).every(p)`, where `map`
 * cannot change the length - which is a false positive of exactly the kind that gets a scanner switched
 * off. The strict rule is therefore both less and more permissive than the walk, in the safe direction
 * each time, and the difference is proven by two fixtures rather than argued here.
 */
function detectUnguardedEvery(
    context: Context,
    conjunct: ts.Expression,
    whole: ts.Expression,
    assertion: ts.CallExpression,
): Verdict {
    const calls: ts.CallExpression[] = []
    walk(conjunct, (candidate) => {
        if (
            ts.isCallExpression(candidate)
            && ts.isPropertyAccessExpression(candidate.expression)
            && candidate.expression.name.text === "every"
        ) calls.push(candidate)
    })
    if (calls.length === 0) return null

    for (const call of calls) {
        const receiver = (call.expression as ts.PropertyAccessExpression).expression
        if (provablyNonEmpty(context, receiver)) continue
        const receiverText = normalize(context.source, receiver)
        // A guard only protects THIS assertion if it is in this assertion's own condition or in an
        // `if` that encloses it. A `length > 0` inside a DIFFERENT assertion does not: this assertion,
        // taken on its own, still cannot fail. Root fixed exactly that shape in fd3d8fc, where a
        // sibling assertion three lines up carried the guard and two others did not.
        if (detectorEnabled("EVERY_DOMINANCE")) {
            if (iterablePinned(context, receiver, whole, assertion)) continue
        } else {
            const own: ts.Node[] = [whole, ...guardsOf(assertion)]
            if (own.some((scope) => hasNonEmptyGuard(context, scope, receiverText, assertion))) continue
        }

        // A receiver whose emptiness is decided in ANOTHER module is a different situation from a
        // collection this harness just observed. `[].every(...)` is still true, but a module-level
        // constant table being empty is a source-level fact one import away, not a live-data risk
        // that a passing run could conceal. Reported, not counted.
        const roots = observationRoots(context.source, receiver, context.definitions)
        const imported = [...roots].filter((root) => context.imported.has(root))
        if (imported.length > 0 && roots.size === imported.length) {
            return {
                classification: "UNRESOLVED",
                evidence: `\`${oneLine(textOf(context.source, call))}\` has no non-empty guard, and \`[].every(...)\` is true - but the receiver is built only from imported binding(s) (\`${imported.join(", ")}\`), so whether it can be empty is decided in another module rather than by anything this run observes. Not counted as a defect on source text alone; a human should confirm the imported table is non-empty.`,
            }
        }

        // Whether the SUITE would still notice an empty collection, even though this assertion alone
        // would not. This does not change the classification - it changes how urgent the fix is.
        const sibling = hasNonEmptyGuard(context, enclosingScope(assertion), receiverText, assertion)
        return {
            classification: "UNGUARDED_EVERY",
            evidence: `\`${oneLine(textOf(context.source, call))}\` has no non-empty guard on \`${oneLine(textOf(context.source, receiver))}\` in its own condition or in any enclosing \`if\`. \`[].every(...)\` is true, so THIS assertion passes when the collection is empty - including when the code under test silently returned nothing. ${sibling ? `Mitigated at suite level: a different assertion earlier in the same function does pin \`${receiverText}.length\`, so an empty collection would still turn the run red somewhere else. The assertion is still individually unfalsifiable.` : "Nothing earlier in the enclosing function pins the length either, so an empty collection would leave the whole run green."}`,
        }
    }
    return null
}

/** Does this region establish `<receiverText>` is non-empty? */
function hasNonEmptyGuard(context: Context, scope: ts.Node, receiverText: string, assertion: ts.CallExpression): boolean {
    let found = false
    walk(scope, (candidate) => {
        if (found) return
        // Only look at guards that PRECEDE the assertion, or are part of its own condition.
        if (candidate.getStart(context.source) > assertion.getEnd()) return
        if (!ts.isBinaryExpression(candidate)) return
        const kind = candidate.operatorToken.kind
        const left = unwrap(candidate.left)
        const right = unwrap(candidate.right)
        const leftIsLength = isLengthAccess(left)
            && normalize(context.source, (left as ts.PropertyAccessExpression).expression) === receiverText
        const rightIsLength = isLengthAccess(right)
            && normalize(context.source, (right as ts.PropertyAccessExpression).expression) === receiverText
        const leftValue = fold(left, new Map())
        const rightValue = fold(right, new Map())
        if (leftIsLength && typeof rightValue === "number") {
            if (kind === ts.SyntaxKind.GreaterThanToken && rightValue >= 0) found = true
            if (kind === ts.SyntaxKind.GreaterThanEqualsToken && rightValue >= 1) found = true
            if (
                (kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.EqualsEqualsToken)
                && rightValue >= 1
            ) found = true
            if (
                (kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsToken)
                && rightValue === 0
            ) found = true
        }
        if (rightIsLength && typeof leftValue === "number") {
            if (kind === ts.SyntaxKind.LessThanToken && leftValue >= 0) found = true
            if (kind === ts.SyntaxKind.LessThanEqualsToken && leftValue >= 1) found = true
            if (
                (kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.EqualsEqualsToken)
                && leftValue >= 1
            ) found = true
        }
    })
    return found
}

// ---------------------------------------------------------------------------------------------
// the falsifiability detectors: non-constant conditions that are structurally always true
// ---------------------------------------------------------------------------------------------

/**
 * Non-builtin roots a derivation reads, WITHOUT descending into a function already proven pure.
 *
 * `observationRoots` inlines every stable binding, so `canonicalise(PERMISSION_KEYS)` yields the
 * parameters of `canonicalise` as roots and the frozen-root test can never be satisfied. A proven-pure
 * function's own parameters are not observations of anything - they are bound from the argument list,
 * which is walked separately - so the function is recorded as a root and its body is not entered.
 */
function derivationRoots(
    context: Context,
    node: ts.Node,
    depth = 0,
    visiting: ReadonlySet<string> = new Set(),
): Set<string> {
    const roots = new Set<string>()
    if (depth > 6) return roots
    walk(node, (candidate) => {
        if (!ts.isIdentifier(candidate)) return
        const parent = candidate.parent
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === candidate) return
        if (parent && ts.isPropertyAssignment(parent) && parent.name === candidate) return
        const name = candidate.text
        if (BUILTIN_ROOTS.has(name) || visiting.has(name)) return
        if (context.pureLocals.has(name)) {
            roots.add(name)
            return
        }
        const definition = context.definitions.get(name)
        if (definition && definition.stable && definition.initializer) {
            const next = new Set(visiting)
            next.add(name)
            for (const inner of derivationRoots(context, definition.initializer, depth + 1, next)) roots.add(inner)
            return
        }
        roots.add(name)
    })
    return roots
}

function isPureCallable(context: Context, name: string): boolean {
    return PURE_FUNCTIONS.has(name) || context.pureLocals.has(name)
}

/**
 * Remove the parentheses `canonical` adds around an INLINED binding when what it inlined needs none.
 *
 * `canonical` wraps every inlined initialiser in parentheses to preserve precedence, which is right in
 * general and wrong for the only shape that matters here: an alias of a name.
 * `const EXPECTED = PERMISSION_KEYS` makes `JSON.stringify(EXPECTED)` canonicalise to
 * `JSON.stringify((PERMISSION_KEYS))`, which is not textually equal to `JSON.stringify(PERMISSION_KEYS)`
 * - so the copied-constant form of the mirrored-derivation class was invisible for a reason that has
 * nothing to do with the code being asserted about.
 *
 * Only parentheses whose ENTIRE content is an identifier or a dotted member chain are removed. Such an
 * expression has no operator in it, so it binds tighter than anything around it and the parentheses
 * were never carrying meaning. Anything with an operator, a call, an index or a literal in it keeps
 * them, so `((a+b))*c` is untouched. Used ONLY by the mirrored-derivation detector, so no existing
 * verdict can move.
 */
function collapseAliasParens(text: string): string {
    let out = text
    for (let round = 0; round < 6; round += 1) {
        const next = out.replace(/\(([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\)/gu, "$1")
        if (next === out) return out
        out = next
    }
    return out
}

/**
 * The same pure operation applied to the same value, written two ways.
 *
 * A method callee additionally requires the RECEIVER to be alias-identical, not merely spelled the same
 * way. That single condition is what keeps `table.rows.join(",") === table.rows.join(",")` out: the two
 * receivers are two reads of a property of an observed object, neither has an identity, and two reads of
 * a mutable system are the honest shape this scanner must never call a defect.
 */
function samePureApplication(context: Context, left: ts.CallExpression, right: ts.CallExpression): string | null {
    const leftCallee = left.expression
    const rightCallee = right.expression
    let calleeNote: string
    if (ts.isIdentifier(leftCallee) && ts.isIdentifier(rightCallee)) {
        if (leftCallee.text !== rightCallee.text || !isPureCallable(context, leftCallee.text)) return null
        calleeNote = `\`${leftCallee.text}\`, which this file declares and which is provably side-effect free`
    } else if (ts.isPropertyAccessExpression(leftCallee) && ts.isPropertyAccessExpression(rightCallee)) {
        if (leftCallee.name.text !== rightCallee.name.text || !PURE_METHODS.has(leftCallee.name.text)) return null
        const leftReceiver = identityOf(context, leftCallee.expression)
        const rightReceiver = identityOf(context, rightCallee.expression)
        if (!leftReceiver || !rightReceiver || leftReceiver.key !== rightReceiver.key) return null
        calleeNote = `\`.${leftCallee.name.text}()\` over one receiver reached by two routes`
    } else {
        return null
    }
    if (left.arguments.length !== right.arguments.length) return null
    for (let index = 0; index < left.arguments.length; index += 1) {
        const leftIdentity = identityOf(context, left.arguments[index])
        const rightIdentity = identityOf(context, right.arguments[index])
        if (leftIdentity && rightIdentity && leftIdentity.key === rightIdentity.key) continue
        const leftValue = fold(left.arguments[index], new Map())
        const rightValue = fold(right.arguments[index], new Map())
        if (leftValue !== undefined && leftValue === rightValue) continue
        return null
    }
    return calleeNote
}

/**
 * CLASS: IDENTICAL VALUES REACHED THROUGH ALIASES.
 *
 * `const a = x; const b = x; check(a === b)`. This repository has already paid for one: two names both
 * resolving to `JSON.stringify(PERMISSION_KEYS)`, compared against each other.
 *
 * Two forms, and the first needs no assumptions at all. Form A: both operands resolve, through alias
 * steps only - a `const` initialiser, a destructured property, an element of an object or array literal
 * this file builds - to ONE evaluation. The value was computed once; comparing it with itself cannot
 * fail, whatever the value is and however mutable the thing it came from. Form B: the two operands are
 * the same pure operation applied to alias-identical inputs, so the two evaluations must agree.
 *
 * WHAT KEEPS THIS OFF HONEST CODE. An alias chain that bottoms out at two DIFFERENT evaluation sites is
 * two evaluations, and two evaluations are not flagged by this class at all. `const before = read();
 * const after = read(); const a = before; const b = after; check(a === b)` resolves to two sites and
 * stays live, which is the whole point: it is a real measurement that the value did not move.
 */
function detectAliasIdentity(context: Context, conjunct: ts.Expression): Verdict {
    if (!detectorEnabled("ALIAS_IDENTITY")) return null
    const target = unwrap(conjunct)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    const always = ALWAYS_TRUE_WHEN_IDENTICAL.has(kind)
    const never = NEVER_TRUE_WHEN_IDENTICAL.has(kind)
    if (!always && !never) return null
    const leftText = oneLine(textOf(context.source, target.left), 70)
    const rightText = oneLine(textOf(context.source, target.right), 70)

    const left = identityOf(context, target.left)
    const right = identityOf(context, target.right)
    if (left && right && left.key === right.key && normalize(context.source, target.left) !== normalize(context.source, target.right)) {
        const route = [...new Set([...left.via, ...right.via])].map((step) => oneLine(step, 80))
        const where = left.site.pos >= 0
            ? `the value produced at line ${lineOf(context.source, left.site)} (\`${oneLine(textOf(context.source, left.site), 60)}\`)`
            : "one binding"
        const evidence = `\`${leftText}\` and \`${rightText}\` are two names for ONE evaluation - ${where} - reached through ${route.length} alias step(s): ${route.join(" ; ") || "a direct alias"}. Nothing is evaluated twice, so this needs no purity or immutability argument: the comparison is a value against itself.`
        if (never) {
            return {
                classification: "UNRESOLVED",
                evidence: `${evidence} The operator is FALSE for identical operands, so this can never PASS - the opposite defect, outside the vacuity classes.`,
            }
        }
        return { classification: "VACUOUS_ALIAS_IDENTITY", evidence }
    }

    const leftCall = resolveToExpression(context, target.left)
    const rightCall = resolveToExpression(context, target.right)
    if (!leftCall || !rightCall || !ts.isCallExpression(leftCall) || !ts.isCallExpression(rightCall)) return null
    const applied = samePureApplication(context, leftCall, rightCall)
    if (!applied) return null
    const evidence = `\`${leftText}\` and \`${rightText}\` are the SAME pure operation - ${applied} - applied to inputs that are alias-identical, so the two evaluations cannot disagree. A defect in the code under test moves both sides together, which is what makes the comparison unable to fail rather than merely likely to pass.`
    if (never) {
        return {
            classification: "UNRESOLVED",
            evidence: `${evidence} The operator is FALSE for identical operands, so this can never PASS - the opposite defect, outside the vacuity classes.`,
        }
    }
    return { classification: "VACUOUS_ALIAS_IDENTITY", evidence }
}

/**
 * CLASS: EXPECTED AND ACTUAL DERIVED FROM THE SAME SOURCE.
 *
 * `expected = f(x); actual = f(x)`, where the comparison cannot distinguish a defect because a defect
 * changes both sides. The subtle version is the one worth the code: `f` declared in this file, so every
 * existing purity test calls it impure and the self-comparison detector therefore says NOTHING - it
 * cannot reach a verdict at all, so the shape is not even reported today.
 *
 * THREE conditions, and dropping any one of them fabricates a defect out of an honest assertion:
 *   1. the two sides canonicalise to the same derivation text;
 *   2. that derivation is side-effect free, INCLUDING the locally declared functions in it, proven by
 *      `buildPureLocals` rather than assumed;
 *   3. every root of the derivation is a FROZEN import - a production constant this file never touches -
 *      or one of those proven-pure functions. This is the condition that separates the class from the
 *      strongest assertion in the tree. `table.rows.join(",")` written twice canonicalises identically
 *      and is pure, and it is a real before/after measurement of a mutable system; its root is an
 *      observation, not an imported constant, so it is NOT this class and stays UNRESOLVED.
 * Plus: nothing between the two evaluations may be able to change what the second one reads, or the
 * comparison is a genuine test of whatever sits in the gap.
 */
function detectMirroredDerivation(context: Context, conjunct: ts.Expression): Verdict {
    if (!detectorEnabled("MIRRORED_DERIVATION")) return null
    const target = unwrap(conjunct)
    if (!ts.isBinaryExpression(target)) return null
    const kind = target.operatorToken.kind
    const always = ALWAYS_TRUE_WHEN_IDENTICAL.has(kind)
    const never = NEVER_TRUE_WHEN_IDENTICAL.has(kind)
    if (!always && !never) return null
    const shared = collapseAliasParens(canonical(context.source, target.left, context.definitions))
    if (shared !== collapseAliasParens(canonical(context.source, target.right, context.definitions))) return null
    if (!deeplyPureWith(context, target.left) || !deeplyPureWith(context, target.right)) return null
    const roots = new Set([
        ...derivationRoots(context, target.left),
        ...derivationRoots(context, target.right),
    ])
    if (roots.size === 0) return null
    const observed = [...roots].filter((root) => !context.frozen.has(root) && !context.pureLocals.has(root))
    if (observed.length > 0) return null
    const leftSite = resolveToExpression(context, target.left) ?? unwrap(target.left)
    const rightSite = resolveToExpression(context, target.right) ?? unwrap(target.right)
    if (!noInterveningEffect(context, leftSite, rightSite)) return null
    const imports = [...roots].filter((root) => context.frozen.has(root))
    const evidence = `Both sides are the same derivation (\`${oneLine(shared, 90)}\`) over the same source: every root it reads is an imported constant this file never mutates (\`${imports.join(", ") || "none"}\`)${context.pureLocals.size > 0 ? `, through function(s) this file declares and that are provably side-effect free` : ""}, and nothing between the two evaluations can change what the second one reads. The expected side is therefore computed FROM the same thing as the actual side, so no defect in the code under test can make them differ.`
    if (never) {
        return {
            classification: "UNRESOLVED",
            evidence: `${evidence} The operator is FALSE for identical operands, so this can never PASS - the opposite defect, outside the vacuity classes.`,
        }
    }
    return { classification: "VACUOUS_MIRRORED_DERIVATION", evidence }
}

/**
 * CLASS: A BOOLEAN INITIALISED TO A PASSING VALUE WHOSE ASSIGNMENT IS NEVER REACHED.
 *
 * `let ok = true; for (...) if (bad) ok = false; check(ok)` is genuinely falsifiable and is NOT this
 * class - it is the shape most likely to produce a false positive, so only two provable forms count:
 *   (a) the binding is never written AT ALL, anywhere in the file - not by `=`, not by `+=`, not by
 *       `++` - so the conjunct is a constant wearing a name. `fold` cannot see this on its own: it has
 *       no environment, so `check("ready", READY)` with `const READY = true` folds to `undefined` and
 *       every existing detector passes it by.
 *   (b) every assignment to it is guarded by a condition that folds to a constant FALSE, so no
 *       assignment is reachable on any run.
 * The conjunct must additionally be TRUE once the initialiser is substituted. A constant that makes the
 * conjunct FALSE is the opposite defect and is left to the existing literal detector.
 *
 * `check-retainer-runtime.ts:495` is the shape this must not touch: `mismatch` is initialised to "" and
 * assigned under a data-dependent guard, which is reachable, so neither form applies and the existing
 * conditional-init detector keeps reporting it UNRESOLVED with its own reasoning.
 */
/**
 * Names this file proves constant: `const`-like, never written, and with a foldable initialiser.
 *
 * `fold` has no environment of its own, so `const READY = true; check("ready", READY)` folds to
 * `undefined` and every detector passes it by. This is the environment that closes that, and it is
 * sound for one reason: every entry is a binding this file NEVER writes - not by `=`, not by `+=`, not
 * by `++` (`stable`) - whose initialiser is already a literal. Substituting one is substituting a
 * compile-time constant, not guessing a runtime value.
 *
 * Cached against the `definitions` map it was derived from, so the callsite-substitution pass - which
 * hands the chain an EXTENDED definitions map - gets its own environment rather than a stale one.
 */
const CONSTANT_ENVIRONMENTS = new WeakMap<object, Map<string, Constant>>()

function constantEnvironment(definitions: ReadonlyMap<string, Definition>): Map<string, Constant> {
    const cached = CONSTANT_ENVIRONMENTS.get(definitions)
    if (cached) return cached
    const environment = new Map<string, Constant>()
    for (const [name, definition] of definitions) {
        if (!definition.stable || definition.assignments.length > 0 || !definition.initializer) continue
        const value = fold(definition.initializer, new Map())
        if (value === undefined) continue
        environment.set(name, value)
    }
    CONSTANT_ENVIRONMENTS.set(definitions, environment)
    return environment
}

function detectUnreachedInitialiser(context: Context, conjunct: ts.Expression): Verdict {
    if (!detectorEnabled("UNREACHED_INITIALISER")) return null
    const constants = constantEnvironment(context.definitions)
    const names = new Set<string>()
    walk(conjunct, (candidate) => {
        if (ts.isIdentifier(candidate)) names.add(candidate.text)
    })
    for (const name of names) {
        const definition = context.definitions.get(name)
        if (!definition || !definition.initializer) continue
        const initial = fold(definition.initializer, new Map())
        if (initial === undefined) continue
        const environment = new Map<string, Constant>(constants)
        environment.set(name, initial)
        const withInitial = fold(conjunct, environment)
        if (withInitial === undefined || !withInitial) continue
        const declaredAt = lineOf(context.source, definition.initializer)
        if (definition.stable && definition.assignments.length === 0) {
            return {
                classification: "VACUOUS_UNREACHED_INITIALISER",
                evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)} at line ${declaredAt} and is never written anywhere in this file - no assignment, no compound assignment, no increment - so with that value substituted this conjunct is \`${oneLine(textOf(context.source, conjunct))}\` = true on every run. It is a constant wearing a name, and the code under test cannot make it false.`,
            }
        }
        if (definition.assignments.length === 0) continue
        const blocked = definition.assignments.map((assignment) =>
            guardsOf(assignment).find((guard) => guard.pos >= 0 && fold(guard, constants) === false) ?? null)
        if (blocked.every((guard) => guard !== null)) {
            const first = blocked[0] as ts.Expression
            return {
                classification: "VACUOUS_UNREACHED_INITIALISER",
                evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)} at line ${declaredAt}, and every one of its ${definition.assignments.length} assignment(s) sits under a guard that folds to a constant false (\`${oneLine(textOf(context.source, first), 70)}\`, with this file's own compile-time constants substituted), so no assignment is reachable on any run. The binding keeps its initialiser and this conjunct is true whatever the code under test does.`,
            }
        }
    }
    return null
}

/**
 * CLASS: A REPLAY LOOP THAT CAN EXECUTE ZERO TIMES.
 *
 * `let running = 0; for (const row of rows) running += row.delta; check("replay reproduces every
 * balance", running === expected)`. On an empty `rows` the body never runs, the accumulator still holds
 * its initialiser, and the assertion compares initial values - it reports that a replay reproduced every
 * stored balance without replaying one.
 *
 * A pin carries the class away entirely: `ledger.length === 6 && mismatch === "" && running === total`
 * cannot pass on an empty ledger, so it is live, and that is exactly how `check-retainer-runtime.ts:495`
 * was hardened. The pin has to be a CONJUNCT of the assertion's own condition or of an enclosing `if`
 * (see `pinScopes`); a pin under `||`, or inside the loop body, does not stop the assertion passing on
 * zero iterations.
 *
 * Also live, and deliberately: an accumulator written anywhere OUTSIDE the loop (`escapes`), because
 * then it moves whatever the collection holds.
 */
function detectEmptyReplay(
    context: Context,
    conjunct: ts.Expression,
    whole: ts.Expression,
    assertion: ts.CallExpression,
): Verdict {
    if (!detectorEnabled("EMPTY_REPLAY")) return null
    const names = new Set<string>()
    walk(conjunct, (candidate) => {
        if (ts.isIdentifier(candidate)) names.add(candidate.text)
    })
    for (const name of names) {
        const accumulator = context.accumulators.get(name)
        if (!accumulator || accumulator.escapes) continue
        const definition = context.definitions.get(name)
        if (!definition || !definition.initializer) continue
        const initial = fold(definition.initializer, new Map())
        if (initial === undefined) continue
        const withInitial = fold(conjunct, new Map<string, Constant>([[name, initial]]))
        if (withInitial === undefined || !withInitial) continue
        if (!accumulator.iterable) {
            return {
                classification: "UNRESOLVED",
                evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)} and is only written inside the loop at line ${accumulator.line}, and with the initialiser this conjunct is TRUE - so a run in which the loop body never executes passes this assertion without replaying anything. Not counted: the loop's trip count cannot be read off its head (it is a \`while\` or a \`for\` whose condition this scanner does not model), so whether zero iterations is reachable needs the runtime. Worth a human read.`,
            }
        }
        if (iterablePinned(context, accumulator.iterable, whole, assertion)) continue
        const iterableText = oneLine(textOf(context.source, accumulator.iterable), 70)
        const roots = observationRoots(context.source, accumulator.iterable, context.definitions)
        const imported = [...roots].filter((root) => context.imported.has(root))
        if (imported.length > 0 && roots.size === imported.length) {
            return {
                classification: "UNRESOLVED",
                evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)}, is written only inside the loop over \`${iterableText}\` at line ${accumulator.line}, and with the initialiser this conjunct is TRUE - so zero iterations passes the assertion. Not counted: the iterated collection is built only from imported binding(s) (\`${imported.join(", ")}\`), so whether it can be empty is decided in another module rather than by anything this run observes.`,
            }
        }
        return {
            classification: "VACUOUS_EMPTY_REPLAY",
            evidence: `\`${name}\` is initialised to ${JSON.stringify(initial)} and is written ONLY inside the loop over \`${iterableText}\` at line ${accumulator.line}. Nothing in this assertion's own condition, and no enclosing \`if\`, pins \`${iterableText}\` to at least one element, so on an empty collection the loop body never runs, \`${name}\` still holds its initialiser, and this conjunct is \`${oneLine(textOf(context.source, conjunct))}\` = true. The assertion then reports a successful replay of nothing - including when the code under test silently produced no rows at all.`,
        }
    }
    return null
}

/**
 * CLASS: A CONJUNCT WHOSE MUTATION CANNOT AFFECT THE VERDICT.
 *
 * A conjunct that its siblings already force true contributes nothing: change it, weaken it, or delete
 * it, and every run that passed still passes. That is the mutation-testing definition of a condition
 * that measures nothing, and it is reachable on source text in three decidable forms - a duplicate
 * conjunct; a conjunct that is a disjunction one of whose disjuncts is a sibling conjunct, so the whole
 * conjunct is forced true; and entailment between two comparisons of the same subject against constants,
 * decided by exhaustion over a sufficient sample rather than by an operator table.
 *
 * Mutual entailment - two ways of writing one bound - flags only the LATER conjunct, so one redundancy
 * produces one finding rather than two.
 */
function detectDominatedConjunct(
    context: Context,
    conjunct: ts.Expression,
    siblings: readonly ts.Expression[],
): Verdict {
    if (!detectorEnabled("DOMINATED_CONJUNCT")) return null
    if (siblings.length < 2) return null
    const index = siblings.indexOf(conjunct)
    if (index < 0) return null
    const self = normalize(context.source, conjunct)
    const selfText = oneLine(textOf(context.source, conjunct), 70)

    // `&&` evaluates left to right, so a conjunct between the two being compared runs BETWEEN them.
    // If anything in that gap can have an effect - a call this scanner cannot prove pure, an
    // assignment, an `await` - then the two readings of the "same" subject are two readings of a
    // system that moved, and neither dominates the other. `a.length > 0 && drain() && a.length === 3`
    // is a real assertion about `drain`, and must not be reported.
    const undisturbed = (other: ts.Expression): boolean => noInterveningEffect(context, conjunct, other)

    for (let earlier = 0; earlier < index; earlier += 1) {
        if (normalize(context.source, siblings[earlier]) !== self) continue
        if (!undisturbed(siblings[earlier])) continue
        return {
            classification: "VACUOUS_DOMINATED_CONJUNCT",
            evidence: `\`${selfText}\` is a duplicate of the conjunct at line ${lineOf(context.source, siblings[earlier])} of the same condition. The two are joined by \`&&\`, so this copy cannot change the verdict: any run in which it is false is a run the first copy already failed. Mutating it changes nothing, which is the definition of a condition that measures nothing.`,
        }
    }

    const parts = disjuncts(conjunct)
    if (parts.length > 1) {
        for (const part of parts) {
            const partText = normalize(context.source, part)
            const sibling = siblings.find(
                (candidate) => candidate !== conjunct && normalize(context.source, candidate) === partText,
            )
            if (!sibling || !undisturbed(sibling)) continue
            return {
                classification: "VACUOUS_DOMINATED_CONJUNCT",
                evidence: `\`${selfText}\` is a disjunction one of whose branches, \`${oneLine(textOf(context.source, part), 60)}\`, is a SIBLING conjunct of the same condition (line ${lineOf(context.source, sibling)}). The sibling must be true for the assertion to pass, and a true branch makes the whole disjunction true, so this conjunct cannot be false on any passing run whatever the other branch does.`,
            }
        }
    }

    const claim = asBound(context, conjunct)
    if (!claim) return null
    for (const sibling of siblings) {
        if (sibling === conjunct) continue
        if (normalize(context.source, sibling) === self) continue
        const premise = asBound(context, sibling)
        if (!premise) continue
        if (!boundEntails(premise, claim)) continue
        if (!undisturbed(sibling)) continue
        // Two spellings of one bound: report the later, so one redundancy is one finding.
        if (boundEntails(claim, premise) && siblings.indexOf(sibling) > index) continue
        return {
            classification: "VACUOUS_DOMINATED_CONJUNCT",
            evidence: `\`${premise.text}\` is a conjunct of this same condition and already forces \`${claim.text}\`: over the subject \`${oneLine(claim.subject, 50)}\` every value satisfying the first satisfies the second. So this conjunct is true on every run where the assertion passes, and mutating it - loosening the bound, or deleting it - cannot turn a green run red.`,
        }
    }
    return null
}

// ---------------------------------------------------------------------------------------------
// the detector chain, in precedence order
// ---------------------------------------------------------------------------------------------

/**
 * ONE chain, used by both the in-place scan and the callsite-substitution pass.
 *
 * They must not diverge. Every soundness argument in this file, and every self-test fixture that
 * proves one, is an argument about this chain; a second copy for the callsite pass would be a second
 * thing to trust. The pass changes only the `definitions` it hands in.
 *
 * PRECEDENCE IS LOAD-BEARING, and each of the five falsifiability detectors sits where it does for a
 * stated reason rather than by arrival order. The chain returns the FIRST non-null verdict, so a
 * detector placed after one that already says something about the same shape can never speak.
 *
 *   `detectAliasIdentity` and `detectMirroredDerivation` run BEFORE `detectSelfComparison` because its
 *   tier 3 answers exactly the shape they PROVE. Two names inlining to one text is reported UNRESOLVED
 *   by tier 3 - "worth a human read" - and that verdict is non-null, so it would silence the proof.
 *   The repository's real instance (two names both resolving to `JSON.stringify(PERMISSION_KEYS)`) is
 *   in that tier today, and moving it from a suspicion to a proof is the point of the class.
 *
 *   `detectUnreachedInitialiser` runs BEFORE `detectConditionalInit` for the same reason in the other
 *   direction: a `let` whose every assignment sits under a constant-false guard is reported UNRESOLVED
 *   by the conditional-init detector, and the unreached-initialiser argument is a proof of the same
 *   shape. It cannot steal a conditional-init finding: form (a) requires ZERO assignments, and form (b)
 *   requires every guard to FOLD to false, which is strictly stronger than "guarded".
 *
 *   `detectEmptyReplay` runs AFTER `detectConditionalInit`, deliberately giving up a little reach to
 *   keep a promise. `check-retainer-runtime.ts:495` is a `=`-assigned loop variable that both detectors
 *   can see, and it is a REPORTED finding with a justification on the record; running the replay
 *   detector first would restate it in a different class. An accumulator updated with `+=` or `++` -
 *   the shape the class exists for - is not in `definitions.assignments` at all, so conditional-init
 *   says nothing about it and the ordering costs the class nothing there.
 *
 *   `detectDominatedConjunct` runs LAST because it is the only detector whose subject is the conjunct's
 *   RELATIONSHIP to its siblings rather than the conjunct itself. Anything an earlier detector can
 *   prove about the conjunct on its own is more actionable than "a sibling already forces it".
 */
function classifyConjunct(
    context: Context,
    conjunct: ts.Expression,
    whole: ts.Expression,
    assertion: ts.CallExpression,
    siblings: readonly ts.Expression[],
): Verdict {
    return detectLiteral(context, conjunct, assertion)
        ?? detectTautology(context, conjunct)
        ?? detectAliasIdentity(context, conjunct)
        ?? detectMirroredDerivation(context, conjunct)
        ?? detectSelfComparison(context, conjunct)
        ?? detectDerivedExpectation(context, conjunct)
        ?? detectUnreachedInitialiser(context, conjunct)
        ?? detectConditionalInit(context, conjunct, siblings)
        ?? detectEmptyReplay(context, conjunct, whole, assertion)
        ?? detectUnguardedEvery(context, conjunct, whole, assertion)
        ?? detectDominatedConjunct(context, conjunct, siblings)
}

// ---------------------------------------------------------------------------------------------
// condition-BUILDING wrappers, and what their callsites pass
// ---------------------------------------------------------------------------------------------

type ConditionBuilder = Readonly<{
    wrapper: string
    parameter: string
    parameterIndex: number
    /** The assertion call inside the wrapper body, and the condition it is given. */
    assertion: ts.CallExpression
    condition: ts.Expression
    /** Span of the wrapper's own declaration, so its recursive self-calls are not treated as callsites. */
    start: number
    end: number
}>

/**
 * Wrappers that BUILD a condition out of one parameter rather than forwarding a boolean.
 *
 * The complement of the tier-2 set: the same walk, but kept when `collectBooleanPositions` finds
 * NOTHING - the parameter reaches the helper's condition slot only as an operand of a comparison, or
 * as a receiver, so the argument at the callsite is a string, an array or a fixture handle, never the
 * condition. `expectOrder`, `protectedCase` and `expectRuntimeError` are the shapes the review named.
 *
 * The set is WIDER than those three, and deliberately so: it also picks up a driver that takes an
 * observation handle and asserts on it (`runChecks(db)`, `runSuite(tx)`), because the risk is the same
 * one - a value chosen at the callsite reaching a condition the callsite cannot be seen from. A name
 * that is only ever used AS a value, never called (`flakyAction`, passed to a service), yields an entry
 * with zero callsites; that is reported as zero rather than hidden, so the difference between "checked
 * and clean" and "never reached" stays visible.
 *
 * One builder is recorded per (function, assertion call), so a wrapper whose body asserts three times
 * has each of its three conditions substituted independently.
 *
 * Exactly one parameter may be involved. With two, "which argument is the expectation" is a guess, and
 * a guess is how a scanner fabricates a defect.
 */
function discoverConditionBuilders(source: ts.SourceFile, helpers: ReadonlyMap<string, number>): ConditionBuilder[] {
    const builders: ConditionBuilder[] = []
    walk(source, (node) => {
        const candidate = asFunctionLike(node)
        if (!candidate || !candidate.body) return
        // A name that IS a helper was registered by tier 2: it forwards a condition, so its callsite
        // argument is already scanned as a condition and there is nothing to substitute.
        if (helpers.has(candidate.name)) return
        const parameters = new Map<string, number>()
        candidate.parameters.forEach((parameter, index) => {
            if (ts.isIdentifier(parameter.name)) parameters.set(parameter.name.text, index)
        })
        if (parameters.size === 0) return
        walk(candidate.body as ts.Node, (inner) => {
            if (!ts.isCallExpression(inner)) return
            const callee = calleeName(inner)
            if (!callee) return
            const conditionIndex = helpers.get(callee)
            if (conditionIndex === undefined) return
            const condition = inner.arguments[conditionIndex]
            if (!condition) return
            const forwarded = new Set<string>()
            collectBooleanPositions(condition, new Set(parameters.keys()), forwarded)
            if (forwarded.size > 0) return
            const used = [...parameters.keys()].filter((name) => readsName(condition, name))
            if (used.length !== 1) return
            builders.push({
                wrapper: candidate.name,
                parameter: used[0],
                parameterIndex: parameters.get(used[0]) as number,
                assertion: inner,
                condition,
                start: node.getStart(source),
                end: node.getEnd(),
            })
        })
    })
    return builders
}

/** Does `expression` READ the binding `name`? A property called `name` is not a read of it. */
function readsName(expression: ts.Node, name: string): boolean {
    return contains(expression, (candidate) => {
        if (!ts.isIdentifier(candidate) || candidate.text !== name) return false
        const parent = candidate.parent
        if (parent && ts.isPropertyAccessExpression(parent) && parent.name === candidate) return false
        if (parent && ts.isPropertyAssignment(parent) && parent.name === candidate) return false
        return true
    })
}

/**
 * The one thing in-place scanning of a condition-building wrapper cannot see: what the CALLSITE passed.
 *
 * Substitute the callsite argument for the wrapper's parameter - as a synthesised stable binding, so
 * `canonical`, `resolveToExpression` and `observationRoots` all follow it exactly as they follow a real
 * `const` - and re-run the SAME detector chain on the wrapper's own condition. A verdict is emitted
 * only when it is NOT already reachable in place, so every finding here is by construction one the
 * body-only scan could not have produced, and is attributed to the callsite line that caused it.
 *
 * WHY THIS IS SOUND AND NOT A SHARED-ROOT GUESS. Nothing new is asserted about derivation. The chain's
 * own rules decide, and they already refuse a shared root on its own: `detectDerivedExpectation`
 * requires the expectation to be a BRANCH on the observation with constant results, and
 * `detectSelfComparison` requires textual identity after inlining plus provable purity. Substitution
 * only makes the argument visible to those rules. Concretely, this is what keeps a real assertion out
 * of the count: `expectOrder(d, sorted(idsIn(a, d)), why)` against a body comparing `idsIn(a, d)`
 * shares the root `a`, and canonicalises to `[...idsIn(a,d)].sort(byId)` versus `idsIn(a,d)` - not
 * identical, not a branch, so not flagged. It is a live assertion that the response is already sorted.
 *
 * MEASURED at Q4-B: 18 builder entries, 87 callsite arguments substituted, 0 findings - read the
 * current numbers off a run rather than trusting this line. The review that asked for this walked every
 * `expectOrder` callsite by hand and found no live instance either, so agreement with a hand audit is
 * the only evidence available that the pass is not silently vacuous. Which is why the self-test carries
 * a fixture it MUST catch, a control whose callsite argument shares an observation root with the body
 * and must stay live, and a mutation - emptying the builder set - under which the fixture goes back to
 * being invisible.
 */
function scanBuilderCallsites(
    context: Context,
    builders: readonly ConditionBuilder[],
): Readonly<{ findings: Finding[]; notes: string[]; skipped: string[]; callsiteCount: number }> {
    const findings: Finding[] = []
    const notes: string[] = []
    const skipped: string[] = []
    let callsiteCount = 0

    for (const builder of builders) {
        // Substitution is keyed by NAME, over a file-wide definition map. If the parameter's name is
        // also a real binding in this file, overriding it could make the detectors reason about the
        // wrong value somewhere else in the same condition. Skip and say so.
        if (context.definitions.has(builder.parameter)) {
            skipped.push(
                `${builder.wrapper}(arg${builder.parameterIndex} = \`${builder.parameter}\`): the parameter name is also a file-level binding, so callsite substitution was skipped rather than risk resolving the wrong one`,
            )
            continue
        }
        const callsites: ts.CallExpression[] = []
        walk(context.source, (node) => {
            if (!ts.isCallExpression(node) || calleeName(node) !== builder.wrapper) return
            const start = node.getStart(context.source)
            if (start >= builder.start && start < builder.end) return
            if (node.arguments.length <= builder.parameterIndex) return
            callsites.push(node)
        })
        notes.push(
            `${builder.wrapper}(arg${builder.parameterIndex} = \`${builder.parameter}\`) builds its condition at line ${lineOf(context.source, builder.condition)}; ${callsites.length} callsite argument(s) substituted`,
        )
        callsiteCount += callsites.length

        const parts = conjuncts(builder.condition)
        for (const callsite of callsites) {
            const argument = callsite.arguments[builder.parameterIndex]
            const extended = new Map(context.definitions)
            extended.set(builder.parameter, { initializer: argument, stable: true, assignments: [] })
            const substituted: Context = { ...context, definitions: extended }
            for (const conjunct of parts) {
                const inPlace = classifyConjunct(context, conjunct, builder.condition, builder.assertion, parts)
                const withArgument = classifyConjunct(substituted, conjunct, builder.condition, builder.assertion, parts)
                const verdict = withArgument && inPlace?.classification !== withArgument.classification
                    ? withArgument
                    : identicalAfterSubstitution(substituted, conjunct, inPlace)
                if (!verdict) continue
                const finding: Finding = {
                    file: context.file,
                    line: lineOf(context.source, callsite),
                    helper: builder.wrapper,
                    assertion: builderAssertionName(context, builder),
                    conjunct: `${oneLine(textOf(context.source, conjunct), 80)}  [with \`${builder.parameter}\` = ${oneLine(textOf(context.source, argument), 60)}]`,
                    classification: verdict.classification,
                    evidence: `CALLSITE-DERIVED, invisible to the in-place scan of \`${builder.wrapper}\` because \`${builder.parameter}\` is an opaque parameter there. ${verdict.evidence}`,
                }
                if (finding.classification === "UNRESOLVED") {
                    findings.push(finding)
                    continue
                }
                // Evidence is taken at the CALLSITE, which is where the argument was chosen; a
                // deliberate bad argument in a self-test is marked there, not in the wrapper.
                const deliberate = fixtureEvidence(context, callsite)
                findings.push(
                    deliberate
                        ? {
                            ...finding,
                            classification: "INTENTIONAL_FIXTURE_SELF_CHECK",
                            evidence: `${finding.evidence} RECLASSIFIED as deliberate: ${deliberate}`,
                        }
                        : finding,
                )
            }
        }
    }
    return { findings, notes, skipped, callsiteCount }
}

/**
 * The interprocedural `x === x`: both operands become the same text once the callsite argument is in,
 * but purity cannot be established, so it is DECLARED rather than counted.
 *
 * `detectSelfComparison` already counts this when both sides are provably side-effect free, and
 * already reports it UNRESOLVED when they resolve equal through pure bindings. What is left is the
 * common real shape - the derivation runs through a locally declared function this scanner cannot
 * prove pure - where the honest answer is that source text cannot settle whether the two evaluations
 * could differ. A declared unknown; never a clean.
 */
function identicalAfterSubstitution(substituted: Context, conjunct: ts.Expression, inPlace: Verdict): Verdict {
    if (inPlace) return null
    const target = unwrap(conjunct)
    if (!ts.isBinaryExpression(target)) return null
    if (!ALWAYS_TRUE_WHEN_IDENTICAL.has(target.operatorToken.kind)) return null
    const left = canonical(substituted.source, target.left, substituted.definitions)
    const right = canonical(substituted.source, target.right, substituted.definitions)
    if (left !== right) return null
    if (deeplyPure(target.left, substituted.definitions) && deeplyPure(target.right, substituted.definitions)) {
        // Provably pure and identical: the chain itself reaches a verdict, so this tier adds nothing.
        return null
    }
    return {
        classification: "UNRESOLVED",
        evidence: `Once the callsite argument is substituted both operands are the same expression text (\`${oneLine(left, 90)}\`), which LOOKS like x === x across the call boundary. Not counted: the text contains at least one call this scanner cannot prove side-effect free, so whether the two evaluations could differ needs the runtime. Worth a human read.`,
    }
}

/** The name string the wrapper's own assertion is given, for the report line. */
function builderAssertionName(context: Context, builder: ConditionBuilder): string {
    const nameArgument = builder.assertion.arguments.find(
        (argument) => ts.isStringLiteral(argument)
            || ts.isTemplateExpression(argument)
            || ts.isNoSubstitutionTemplateLiteral(argument),
    )
    return nameArgument ? oneLine(textOf(context.source, nameArgument), 90) : "(unnamed)"
}

// ---------------------------------------------------------------------------------------------
// deliberate-fixture evidence
// ---------------------------------------------------------------------------------------------

/**
 * Evidence that a non-live assertion is non-live ON PURPOSE - a fixture-wiring proof, a controlled
 * bad fixture in a self-test, a precondition scaffold. The evidence text is carried into the report
 * so the decision can be argued with rather than trusted.
 */
function fixtureEvidence(context: Context, assertion: ts.CallExpression): string | null {
    const name = assertion.arguments.find((argument) => ts.isStringLiteral(argument) || ts.isTemplateExpression(argument))
    if (name) {
        const text = textOf(context.source, name)
        const match = FIXTURE_EVIDENCE.exec(text)
        if (match) return `assertion name carries "${match[0]}": ${oneLine(text, 110)}`
    }
    for (let current: ts.Node | undefined = assertion; current; current = current.parent) {
        const ranges = ts.getLeadingCommentRanges(context.source.text, current.getFullStart()) ?? []
        for (const range of ranges) {
            const comment = context.source.text.slice(range.pos, range.end)
            const match = FIXTURE_EVIDENCE.exec(comment)
            if (match) return `leading comment carries "${match[0]}": ${oneLine(comment, 160)}`
        }
        if (ts.isStatement(current) && current.parent && ts.isBlock(current.parent)) break
    }
    let scope: ts.Node | undefined = assertion.parent
    while (scope && !ts.isSourceFile(scope)) {
        const named = (ts.isFunctionDeclaration(scope) || ts.isMethodDeclaration(scope)) && scope.name
            ? scope.name.getText(context.source)
            : null
        if (named && /fixture|selftest|self_test|controlled|proveFailure|prove_failure/iu.test(named)) {
            return `enclosing function is named \`${named}\``
        }
        scope = scope.parent
    }
    return null
}

// ---------------------------------------------------------------------------------------------
// the scan
// ---------------------------------------------------------------------------------------------

type ScanResult = Readonly<{
    findings: readonly Finding[]
    assertionCount: number
    helpers: readonly string[]
    discovery: HelperDiscovery
    /** Condition-building wrappers whose callsite arguments were substituted, and any that were not. */
    builderNotes: readonly string[]
    builderSkipped: readonly string[]
    builderCallsites: number
}>

function scan(file: string, text: string): ScanResult {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const discovery = discoverHelpers(source)
    const helpers = discovery.helpers
    const definitions = buildDefinitions(source)
    const facts = buildFieldFacts(source)

    const assertions: ts.CallExpression[] = []
    walk(source, (node) => {
        if (!ts.isCallExpression(node)) return
        const name = calleeName(node)
        if (!name || !helpers.has(name)) return
        // Skip the helper's own declaration site and recursive wrappers with no real argument.
        const index = helpers.get(name) as number
        if (node.arguments.length <= index) return
        assertions.push(node)
    })

    // The data-flow layers the falsifiability detectors read. Order matters in one place only:
    // `frozen` asks which calls could have handed a binding away, and a call to a function proven pure
    // does not count, so `pureLocals` has to exist first.
    const imported = importedNames(source)
    const pureLocals = buildPureLocals(source)
    const context: Context = {
        file,
        source,
        definitions,
        facts,
        assertions,
        helpers,
        imported,
        destructured: buildDestructuredAliases(source),
        frozen: buildFrozenRoots(source, imported, pureLocals),
        pureLocals,
        accumulators: buildLoopAccumulators(source),
    }
    const findings: Finding[] = []

    for (const assertion of assertions) {
        const helper = calleeName(assertion) as string
        const index = helpers.get(helper) as number
        const condition = assertion.arguments[index]
        const nameArgument = assertion.arguments.find(
            (argument) => ts.isStringLiteral(argument) || ts.isTemplateExpression(argument) || ts.isNoSubstitutionTemplateLiteral(argument),
        )
        const assertionName = nameArgument ? oneLine(textOf(source, nameArgument), 90) : "(unnamed)"
        const parts = conjuncts(condition)
        const emitted: Finding[] = []

        for (const conjunct of parts) {
            const verdict = classifyConjunct(context, conjunct, condition, assertion, parts)
            if (!verdict) continue
            emitted.push({
                file,
                line: lineOf(source, conjunct),
                helper,
                assertion: assertionName,
                conjunct: oneLine(textOf(source, conjunct)),
                classification: verdict.classification,
                evidence: verdict.evidence,
            })
        }

        for (const finding of emitted) {
            if (finding.classification === "UNRESOLVED" || finding.classification === "INTENTIONAL_FIXTURE_SELF_CHECK") {
                findings.push(finding)
                continue
            }
            const evidence = fixtureEvidence(context, assertion)
            findings.push(
                evidence
                    ? {
                        ...finding,
                        classification: "INTENTIONAL_FIXTURE_SELF_CHECK",
                        evidence: `${finding.evidence} RECLASSIFIED as deliberate: ${evidence}`,
                    }
                    : finding,
            )
        }
    }

    const builders = discoverConditionBuilders(source, helpers)
    const builderPass = scanBuilderCallsites(context, builders)
    findings.push(...builderPass.findings)

    return {
        findings,
        assertionCount: assertions.length,
        helpers: [...helpers.keys()].sort(),
        discovery,
        builderNotes: builderPass.notes,
        builderSkipped: builderPass.skipped,
        builderCallsites: builderPass.callsiteCount,
    }
}

// ---------------------------------------------------------------------------------------------
// fixtures - one vacuous case per class, plus a live control per class
// ---------------------------------------------------------------------------------------------

const PRELUDE = [
    "const results: Array<{ name: string; pass: boolean; detail: string }> = []",
    "function check(name: string, pass: boolean, detail = '') { results.push({ name, pass, detail }) }",
    "function checkInvertible(name: string, pass: boolean, detail = '') { results.push({ name, pass, detail }) }",
].join("\n")

type Fixture = Readonly<{ name: string; expect: Classification; body: string }>

const VACUOUS_FIXTURES: readonly Fixture[] = [
    {
        name: "literal",
        expect: "VACUOUS_LITERAL",
        body: [
            "declare const observedTitle: string",
            "check('a variant can be renamed', true, observedTitle)",
        ].join("\n"),
    },
    {
        name: "tautology-length",
        expect: "VACUOUS_TAUTOLOGY",
        body: [
            "declare const rows: string[]",
            "check('rows came back', rows.length >= 0, String(rows.length))",
        ].join("\n"),
    },
    {
        name: "tautology-typeof",
        expect: "VACUOUS_TAUTOLOGY",
        body: [
            "declare const row: { at: unknown }",
            "check('the date is a string', typeof row.at === typeof row.at, String(row.at))",
        ].join("\n"),
    },
    {
        name: "self-comparison-direct",
        expect: "VACUOUS_SELF_COMPARISON",
        body: [
            "declare const renamed: { title: string }",
            "check('a variant can be renamed', renamed.title === renamed.title, renamed.title)",
        ].join("\n"),
    },
    {
        name: "self-comparison-through-factory",
        expect: "VACUOUS_SELF_COMPARISON",
        body: [
            "declare function fetchRaw(): string",
            "declare const status: number",
            "function call() {",
            "    const raw = fetchRaw()",
            "    const body = JSON.parse(raw) as Record<string, unknown>",
            "    return Object.freeze({ status, body, raw })",
            "}",
            "const ok = call()",
            "check('the response is round-trippable JSON', JSON.stringify(JSON.parse(ok.raw)) === JSON.stringify(ok.body))",
        ].join("\n"),
    },
    {
        name: "derived-expectation-ternary",
        expect: "VACUOUS_DERIVED_EXPECTATION",
        body: [
            "declare const called: { status: number; body: Record<string, unknown> }",
            "const keys = Object.keys(called.body).sort().join(',')",
            "const expectedEnvelope = called.status < 400 ? 'data,ok' : 'error,ok'",
            "check('the response uses the shared envelope shape', keys === expectedEnvelope, keys)",
        ].join("\n"),
    },
    {
        name: "conditional-init",
        expect: "VACUOUS_CONDITIONAL_INIT",
        body: [
            "declare function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean>",
            "declare const gate: { secondPrewrite: { promise: Promise<unknown> } }",
            "declare const t2: Promise<unknown>",
            "declare const firstPrewriteReached: boolean",
            "async function measure() {",
            "    let secondPrewriteBeforeRelease = false",
            "    let t2SettledBeforeRelease = false",
            "    if (firstPrewriteReached) {",
            "        secondPrewriteBeforeRelease = await settlesWithin(gate.secondPrewrite.promise, 300)",
            "        if (secondPrewriteBeforeRelease) t2SettledBeforeRelease = await settlesWithin(t2, 1500)",
            "    }",
            "    checkInvertible('MEASURED: the row lock holds T2 back', firstPrewriteReached && !secondPrewriteBeforeRelease && !t2SettledBeforeRelease, 'x')",
            "}",
        ].join("\n"),
    },
    {
        name: "unguarded-every",
        expect: "UNGUARDED_EVERY",
        body: [
            "declare const items: Array<{ at: string | null }>",
            "check('every item date is an ISO string or null', items.every((i) => i.at === null || typeof i.at === 'string'))",
        ].join("\n"),
    },
    {
        name: "tautology-excluded-middle",
        expect: "VACUOUS_TAUTOLOGY",
        body: [
            "declare const settled: boolean",
            "declare const rows: string[]",
            "check('the read either settled or did not', settled || !settled, String(rows.length))",
        ].join("\n"),
    },
    {
        name: "derived-expectation-guarded-let",
        expect: "VACUOUS_DERIVED_EXPECTATION",
        body: [
            "declare const called: { status: number; keys: string }",
            "let expectedEnvelope = 'error,ok'",
            "if (called.status < 400) { expectedEnvelope = 'data,ok' }",
            "check('the response uses the shared envelope shape', called.keys === expectedEnvelope, called.keys)",
        ].join("\n"),
    },
    {
        name: "alias-followed",
        expect: "VACUOUS_SELF_COMPARISON",
        body: [
            "declare const renamed: { title: string }",
            "const ok = check",
            "ok('a variant can be renamed', renamed.title === renamed.title, renamed.title)",
        ].join("\n"),
    },
    {
        name: "forwarding-wrapper-followed",
        expect: "VACUOUS_SELF_COMPARISON",
        body: [
            "declare const INVERT: boolean",
            "declare const renamed: { title: string }",
            "function checkInverted(name: string, pass: boolean, detail = '') {",
            "    check(name, INVERT ? !pass : pass, detail)",
            "}",
            "checkInverted('a variant can be renamed', renamed.title === renamed.title, renamed.title)",
        ].join("\n"),
    },
    {
        name: "forwarding-wrapper-two-levels",
        expect: "VACUOUS_LITERAL",
        body: [
            "declare const observedTitle: string",
            "// Declared BEFORE the wrapper it wraps, on purpose: a single discovery pass cannot register",
            "// `checkNamed`, because `checkInverted` is not a known helper yet when this line is walked.",
            "// Only the second round closes the chain, so this fixture genuinely exercises depth 2.",
            "function checkNamed(name: string, ok: boolean, detail = '') { checkInverted(name, ok, detail) }",
            "function checkInverted(name: string, pass: boolean, detail = '') { check(name, pass, detail) }",
            "checkNamed('a variant can be renamed', true, observedTitle)",
        ].join("\n"),
    },
    {
        name: "forwarding-wrapper-three-levels",
        expect: "VACUOUS_LITERAL",
        body: [
            "declare const observedTitle: string",
            "// Declared OUTERMOST FIRST, which is what makes the depth load-bearing. A round can only",
            "// register a wrapper whose callee is ALREADY a known helper, and the walk visits these in",
            "// source order, so round 1 reaches only `checkL1`, round 2 reaches `checkL2`, and `checkL3`",
            "// is not a helper until round 3. Under the old fixed bound of two rounds this callsite was",
            "// not an assertion at all, so the constant `true` in it was invisible.",
            "function checkL3(name: string, ok: boolean, detail = '') { checkL2(name, ok, detail) }",
            "function checkL2(name: string, ok: boolean, detail = '') { checkL1(name, ok, detail) }",
            "function checkL1(name: string, pass: boolean, detail = '') { check(name, pass, detail) }",
            "checkL3('a variant can be renamed', true, observedTitle)",
        ].join("\n"),
    },
    {
        name: "forwarding-wrapper-four-levels",
        expect: "VACUOUS_LITERAL",
        body: [
            "declare const observedTitle: string",
            "// One link deeper again, registered in round 4. Two fixtures rather than one because a",
            "// single depth-3 case cannot show that the loop closes whatever the depth - it could be",
            "// read as a bound of 3 rather than as a fixed point.",
            "function checkD4(name: string, ok: boolean, detail = '') { checkD3(name, ok, detail) }",
            "function checkD3(name: string, ok: boolean, detail = '') { checkD2(name, ok, detail) }",
            "function checkD2(name: string, ok: boolean, detail = '') { checkD1(name, ok, detail) }",
            "function checkD1(name: string, pass: boolean, detail = '') { check(name, pass, detail) }",
            "checkD4('a variant can be renamed', true, observedTitle)",
        ].join("\n"),
    },
    {
        name: "callsite-derived-expectation-through-a-builder-wrapper",
        expect: "VACUOUS_DERIVED_EXPECTATION",
        body: [
            "declare const called: { status: number; body: Record<string, unknown> }",
            "const gotKeys = Object.keys(called.body).sort().join(',')",
            "// `expectEnvelope` BUILDS its condition, so it is not registered as a helper and its",
            "// callsite argument is never scanned as a condition. In the body `want` is an opaque",
            "// parameter with no definition, so the in-place scan sees `gotKeys === want` and can say",
            "// nothing at all about it. The vacuity is entirely in what the callsite below passes: an",
            "// expectation that branches on the very response `gotKeys` was read from.",
            "const expectEnvelope = (why: string, want: string) => {",
            "    checkInvertible(`the response uses the shared envelope shape, ${why}`, gotKeys === want, gotKeys)",
            "}",
            "expectEnvelope('a refusal keeps the error envelope', called.status < 400 ? 'data,ok' : 'error,ok')",
        ].join("\n"),
    },
    {
        name: "compound-assignment-helper-discovered",
        expect: "VACUOUS_LITERAL",
        body: [
            "let failures = 0",
            "declare const observedTitle: string",
            "function assertThat(condition: unknown, message: string) { if (!condition) { failures += 1; console.error(message) } }",
            "assertThat(true, `a variant can be renamed: ${observedTitle}`)",
        ].join("\n"),
    },

    // ---- the falsifiability classes: NON-CONSTANT conditions that are structurally always true ----
    // Each of the six has a positive fixture here and a SAFE NEAR-MISS in LIVE_CONTROLS - structurally
    // the same shape, genuinely falsifiable - so "it catches the class" and "it does not catch the
    // honest form of the class" are both proven rather than argued. The near-miss is the load-bearing
    // half: a detector with only a positive fixture is indistinguishable from one that flags the shape.

    // CLASS 1: identical values reached through aliases. Three routes, because the alias step is where
    // the proof lives and each route is a different step.
    {
        name: "alias-identity-chain",
        expect: "VACUOUS_ALIAS_IDENTITY",
        body: [
            "declare const observed: { rows: readonly string[] }",
            "// ONE evaluation, two names. `expectedRows` and `actualRows` are the same read of the same",
            "// object, so the comparison is a value against itself whatever the value is.",
            "const snapshot = observed.rows",
            "const expectedRows = snapshot",
            "const actualRows = snapshot",
            "check('the rows came back as stored', actualRows === expectedRows, String(actualRows.length))",
        ].join("\n"),
    },
    {
        name: "alias-identity-destructured",
        expect: "VACUOUS_ALIAS_IDENTITY",
        body: [
            "declare const observed: { rows: readonly string[] }",
            "// The destructured route. `buildDefinitions` cannot see `taken` at all - it records only",
            "// `ts.isIdentifier(node.name)` declarations - so without the destructuring layer this",
            "// comparison is invisible to every detector.",
            "const captured = { taken: observed.rows, at: 0 }",
            "const { taken } = captured",
            "check('the rows came back as stored', taken === captured.taken, String(taken.length))",
        ].join("\n"),
    },
    {
        name: "alias-identity-pure-function-same-receiver",
        expect: "VACUOUS_ALIAS_IDENTITY",
        body: [
            "declare const observed: { rows: readonly string[] }",
            "// The same pure operation applied to inputs that are alias-identical: two evaluations, but",
            "// of one function over one value, so they cannot disagree. `digest` is declared HERE, which",
            "// is why no existing detector reaches this: `isPure` calls every local function impure.",
            "const digest = (xs: readonly string[]) => xs.join('|')",
            "const snapshot = observed.rows",
            "const alsoSnapshot = snapshot",
            "check('the digest is stable', digest(snapshot) === digest(alsoSnapshot), digest(snapshot))",
        ].join("\n"),
    },

    // CLASS 2: a boolean initialised to a PASSING value whose assignment cannot be reached.
    {
        name: "unreached-initialiser-never-written",
        expect: "VACUOUS_UNREACHED_INITIALISER",
        body: [
            "declare const observedTitle: string",
            "// A constant wearing a name. `fold` has no environment, so this folds to `undefined` and the",
            "// literal detector says nothing about it.",
            "const renameAccepted = true",
            "check('a variant can be renamed', renameAccepted, observedTitle)",
        ].join("\n"),
    },
    {
        name: "unreached-initialiser-dead-guard",
        expect: "VACUOUS_UNREACHED_INITIALISER",
        body: [
            "declare const rows: ReadonlyArray<{ stale: boolean }>",
            "// The debug flag left switched off. `ok` LOOKS falsifiable - there is an assignment, and it",
            "// is in a loop over observed data - but the only guard that reaches it is a compile-time",
            "// false, so no run can execute the assignment and `ok` keeps its passing initialiser.",
            "const STRICT_STALENESS = false",
            "let ok = true",
            "for (const row of rows) { if (STRICT_STALENESS && row.stale) { ok = false } }",
            "check('no stale row came back', ok, String(rows.length))",
        ].join("\n"),
    },

    // CLASS 3: `[].every(...)` where the pin is in a position that does not protect the assertion.
    {
        name: "every-pin-under-or",
        expect: "UNGUARDED_EVERY",
        body: [
            "declare const items: Array<{ at: string | null }>",
            "// The pin is real, and it protects nothing: on an empty collection the first disjunct is",
            "// false, `[].every(...)` is true, and the assertion passes.",
            "check('every item date is an ISO string or null', items.length > 0 || items.every((i) => i.at === null || typeof i.at === 'string'))",
        ].join("\n"),
    },
    {
        name: "every-pin-inside-the-callback",
        expect: "UNGUARDED_EVERY",
        body: [
            "declare const rows: readonly number[]",
            "// The pin is INSIDE the predicate, so it runs once per element - which on zero elements is",
            "// never. The assertion still passes on an empty collection.",
            "check('every row is positive', rows.every((r) => rows.length > 0 && r > 0), String(rows.length))",
        ].join("\n"),
    },

    // CLASS 4: a replay loop that can execute zero times, so the assertion compares initial values.
    {
        name: "empty-replay-accumulator",
        expect: "VACUOUS_EMPTY_REPLAY",
        body: [
            "declare const ledger: ReadonlyArray<{ delta: number }>",
            "// On an empty ledger the body never runs, `running` is still 0, and the assertion reports a",
            "// successful replay of nothing - including when the code under test produced no rows at all.",
            "let running = 0",
            "for (const row of ledger) { running += row.delta }",
            "check('replaying every delta nets back to zero', running === 0, String(running))",
        ].join("\n"),
    },

    // CLASS 5: expected and actual derived from the SAME source.
    {
        name: "mirrored-derivation-imported-constant",
        expect: "VACUOUS_MIRRORED_DERIVATION",
        body: [
            "import { PERMISSION_KEYS } from '@/lib/permissions'",
            "// The real instance this repository has already paid for: two names both resolving to",
            "// `JSON.stringify(PERMISSION_KEYS)`, compared against each other. A defect in the production",
            "// constant moves BOTH sides, so the comparison cannot fail.",
            "const expectedDigest = JSON.stringify(PERMISSION_KEYS)",
            "const actualDigest = JSON.stringify(PERMISSION_KEYS)",
            "check('the permission keys are the ones the UI ships', actualDigest === expectedDigest, actualDigest)",
        ].join("\n"),
    },
    {
        name: "mirrored-derivation-copied-production-constant",
        expect: "VACUOUS_MIRRORED_DERIVATION",
        body: [
            "import { PERMISSION_KEYS } from '@/lib/permissions'",
            "// The expected side is a COPY of the production constant rather than an independent",
            "// statement of what the keys should be, so it is the same source wearing a second name.",
            "const EXPECTED_KEYS = PERMISSION_KEYS",
            "check('the permission keys are the ones the UI ships', JSON.stringify(PERMISSION_KEYS) === JSON.stringify(EXPECTED_KEYS), 'keys')",
        ].join("\n"),
    },

    // CLASS 6: a conjunct whose mutation cannot affect the verdict.
    {
        name: "dominated-conjunct-duplicate",
        expect: "VACUOUS_DOMINATED_CONJUNCT",
        body: [
            "declare const refused: { ok: boolean; message: string }",
            "// MEASURED in this tree: check-appointment-authz.ts:245 is exactly this, character for",
            "// character - the same conjunct twice, joined by `&&`.",
            "check('a slot outside published hours is refused', !refused.ok && !refused.ok && /outside/iu.test(refused.message), refused.message)",
        ].join("\n"),
    },
    {
        name: "dominated-conjunct-entailed-bound",
        expect: "VACUOUS_DOMINATED_CONJUNCT",
        body: [
            "declare const posted: { status: number }",
            "// MEASURED in this tree: check-due-work-preview-api.ts:603. `=== 405` already forces",
            "// `!== 200`, so deleting or loosening the second conjunct cannot turn a green run red.",
            "check('the service refuses a POST', posted.status !== 200 && posted.status === 405, String(posted.status))",
        ].join("\n"),
    },
    {
        name: "dominated-conjunct-disjunction-forced-by-a-sibling",
        expect: "VACUOUS_DOMINATED_CONJUNCT",
        body: [
            "declare const settled: boolean",
            "declare const timedOut: boolean",
            "// The sibling must be true for the assertion to pass, and a true branch makes the whole",
            "// disjunction true, so the disjunction measures nothing whatever `timedOut` does.",
            "check('the read settled, or at least did something', settled && (settled || timedOut), String(settled))",
        ].join("\n"),
    },
]

/**
 * Fixtures for the classes that are NOT defects but ARE verdicts this scanner reaches, so each of
 * those paths is proven too. Without these, "10 INTENTIONAL_FIXTURE_SELF_CHECK, 23 UNRESOLVED" would
 * be two numbers no fixture had ever exercised.
 */
const NON_DEFECT_FIXTURES: readonly Fixture[] = [
    {
        name: "intentional-failure-marker",
        expect: "INTENTIONAL_FIXTURE_SELF_CHECK",
        body: [
            "declare const r: { seedFailed: boolean; detail: string }",
            "function run() {",
            "    if (r.seedFailed) { check('SEED FAILED, rule never reached', false, r.detail); return }",
            "}",
        ].join("\n"),
    },
    {
        name: "intentional-deliberate-vacuity",
        expect: "INTENTIONAL_FIXTURE_SELF_CHECK",
        body: [
            "declare const rows: string[]",
            "// A deliberate scaffold: this asserts the harness is wired, by construction, not any behaviour.",
            "check('fixture wiring: the probe ran at all', rows.length >= 0, String(rows.length))",
        ].join("\n"),
    },
    {
        name: "unresolved-two-observations-same-text",
        expect: "UNRESOLVED",
        body: [
            "declare const table: { rows: readonly string[] }",
            "const before = table.rows.join(',')",
            "const after = table.rows.join(',')",
            "check('the preview wrote nothing', before === after, after)",
        ].join("\n"),
    },
    {
        name: "unresolved-conditional-init-unpinned",
        expect: "UNRESOLVED",
        body: [
            "declare function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean>",
            "declare const t2: Promise<unknown>",
            "declare const reached: boolean",
            "async function measure() {",
            "    let settled = false",
            "    if (reached) { settled = await settlesWithin(t2, 1500) }",
            "    checkInvertible('T2 settled', !settled, 'x')",
            "}",
        ].join("\n"),
    },
    {
        name: "unresolved-constant-false-no-evidence",
        expect: "UNRESOLVED",
        body: [
            "declare const rows: string[]",
            "check('rows came back', 1 === 2, String(rows.length))",
        ].join("\n"),
    },
    {
        name: "unresolved-imported-receiver-every",
        expect: "UNRESOLVED",
        body: [
            "import { REGISTRY } from '@/lib/registry'",
            "check('every registry entry is tagged', REGISTRY.every((entry: { tag?: string }) => Boolean(entry.tag)))",
        ].join("\n"),
    },
]

/**
 * Live controls. Each is the honest form of the fixture above it, and MUST NOT be flagged. Without
 * these the self-test would pass for a scanner that classified everything as vacuous.
 */
const LIVE_CONTROLS: readonly Fixture[] = [
    {
        name: "live-literal-comparison",
        expect: "LIVE",
        body: [
            "declare const observedTitle: string",
            "check('a variant can be renamed', observedTitle === 'Small (UK)', observedTitle)",
        ].join("\n"),
    },
    {
        name: "live-length-bound",
        expect: "LIVE",
        body: [
            "declare const rows: string[]",
            "check('exactly three rows came back', rows.length === 3, String(rows.length))",
        ].join("\n"),
    },
    {
        name: "live-typeof",
        expect: "LIVE",
        body: [
            "declare const row: { at: unknown }",
            "check('the date is a string', typeof row.at === 'string', String(row.at))",
        ].join("\n"),
    },
    {
        name: "live-cross-field-comparison",
        expect: "LIVE",
        body: [
            "declare const before: { count: number }",
            "declare const after: { count: number }",
            "check('the count did not move', before.count === after.count, String(after.count))",
        ].join("\n"),
    },
    {
        name: "live-fixed-expectation",
        expect: "LIVE",
        body: [
            "declare const called: { status: number; body: Record<string, unknown> }",
            "declare const expectedStatus: number",
            "const keys = Object.keys(called.body).sort().join(',')",
            "const expectedEnvelope = expectedStatus < 400 ? 'data,ok' : 'error,ok'",
            "checkInvertible('the response really is that status and uses the envelope', called.status === expectedStatus && keys === expectedEnvelope, keys)",
        ].join("\n"),
    },
    {
        name: "live-unconditional-assignment",
        expect: "LIVE",
        body: [
            "declare function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean>",
            "declare const t2: Promise<unknown>",
            "declare const firstPrewriteReached: boolean",
            "async function measure() {",
            "    let t2Settled = false",
            "    t2Settled = await settlesWithin(t2, 1500)",
            "    checkInvertible('T2 settled', firstPrewriteReached && t2Settled, 'x')",
            "}",
        ].join("\n"),
    },
    {
        name: "live-guarded-every",
        expect: "LIVE",
        body: [
            "declare const items: Array<{ at: string | null }>",
            "check('every item date is an ISO string or null', items.length > 0 && items.every((i) => i.at === null || typeof i.at === 'string'))",
        ].join("\n"),
    },
    {
        name: "live-real-disjunction",
        expect: "LIVE",
        body: [
            "declare const settled: boolean",
            "declare const timedOut: boolean",
            "check('the read either settled or timed out', settled || timedOut, String(settled))",
        ].join("\n"),
    },
    {
        name: "live-guarded-let-on-a-different-observation",
        expect: "LIVE",
        body: [
            "declare const called: { status: number; keys: string }",
            "declare const requestedKind: string",
            "let expectedEnvelope = 'error,ok'",
            "if (requestedKind === 'data') { expectedEnvelope = 'data,ok' }",
            "check('the response uses the shared envelope shape', called.keys === expectedEnvelope, called.keys)",
        ].join("\n"),
    },
    {
        name: "live-through-a-forwarding-wrapper",
        expect: "LIVE",
        body: [
            "declare const INVERT: boolean",
            "declare const renamed: { title: string }",
            "function checkInverted(name: string, pass: boolean, detail = '') {",
            "    check(name, INVERT ? !pass : pass, detail)",
            "}",
            "checkInverted('a variant can be renamed', renamed.title === 'Small (UK)', renamed.title)",
        ].join("\n"),
    },
    {
        name: "live-wrapper-that-builds-its-own-condition",
        expect: "LIVE",
        body: [
            "declare const got: readonly string[]",
            "// expectOrder's shape: `expected` is an ARRAY at the callsite, never a condition. Registering",
            "// this wrapper would make the detectors read an array literal as a condition and fold it true.",
            "const expectOrder = (domain: string, expected: readonly string[], why: string) => {",
            "    checkInvertible(`${domain} come back in one order, tying on ${why}`, got.join(',') === expected.join(','), why)",
            "}",
            "expectOrder('reservations', ['a', 'b'], 'one startAt')",
        ].join("\n"),
    },
    {
        name: "live-counter-compared-to-its-total",
        expect: "LIVE",
        body: [
            "declare const transitions: ReadonlyArray<{ ok: boolean }>",
            "// Regression control for a real bug in THIS scanner: both counters are `let x = 0` mutated only",
            "// by `+=`, so a stability check that looked at `=` alone inlined both to the text `(0)` and",
            "// reported a live counter comparison as `x === x`. Three harnesses were mis-flagged this way.",
            "let refusedCount = 0",
            "let totalIllegal = 0",
            "for (const t of transitions) {",
            "    totalIllegal += 1",
            "    if (!t.ok) refusedCount += 1",
            "}",
            "check('every illegal transition is refused', totalIllegal > 0 && refusedCount === totalIllegal, `${refusedCount}/${totalIllegal}`)",
        ].join("\n"),
    },
    {
        name: "live-callsite-expectation-independent-of-the-observation",
        expect: "LIVE",
        body: [
            "declare const called: { status: number; body: Record<string, unknown> }",
            "declare const expectedStatus: number",
            "const gotKeys = Object.keys(called.body).sort().join(',')",
            "const expectEnvelope = (why: string, want: string) => {",
            "    checkInvertible(`the response uses the shared envelope shape, ${why}`, gotKeys === want, gotKeys)",
            "}",
            "expectEnvelope('a refusal keeps the error envelope', expectedStatus < 400 ? 'data,ok' : 'error,ok')",
        ].join("\n"),
    },
    {
        name: "live-callsite-argument-shares-a-root-with-the-observation",
        expect: "LIVE",
        body: [
            "declare const a: { items: ReadonlyArray<{ domain: string; id: string }> }",
            "// The trap the callsite-substitution pass must NOT fall into, and the reason a shared",
            "// observation root can never be the test on its own. Both sides read `a`, so a root-sharing",
            "// rule would flag this - and it is one of the strongest assertions in the tree: that the",
            "// response already comes back in sorted order. Sorting is not the identity, so the two",
            "// canonical texts differ, the argument is not a branch on the observation, and it stays live.",
            "const idsIn = (domain: string) => a.items.filter((i) => i.domain === domain).map((i) => i.id)",
            "const expectOrder = (domain: string, expected: readonly string[]) => {",
            "    checkInvertible(`${domain} come back in the one order a total ordering permits`, idsIn(domain).join(',') === expected.join(','), domain)",
            "}",
            "expectOrder('reservations', [...idsIn('reservations')].sort())",
        ].join("\n"),
    },
    {
        name: "live-counter-mutated-by-increment",
        expect: "LIVE",
        body: [
            "declare const rows: ReadonlyArray<{ stale: boolean }>",
            "let staleSeen = 0",
            "for (const row of rows) { if (row.stale) staleSeen++ }",
            "check('no stale row came back', rows.length > 0 && staleSeen === 0, String(staleSeen))",
        ].join("\n"),
    },

    // ---- the SAFE NEAR-MISSES: one per falsifiability class -------------------------------------
    // Each is structurally the fixture above it and genuinely falsifiable. These are the fixtures that
    // decide whether the classes are usable: a detector that also flags these is a detector that would
    // report the strongest assertions in this tree as defects, and would be switched off within a week.

    // CLASS 1 near-miss: TWO evaluations, aliased. The alias steps are identical to the positive; what
    // differs is that the chain bottoms out at two different sites, which is a real measurement that
    // the value did not move.
    {
        name: "live-two-evaluations-reached-through-aliases",
        expect: "LIVE",
        body: [
            "declare function readRows(): readonly string[]",
            "const before = readRows()",
            "const after = readRows()",
            "const expectedRows = before",
            "const actualRows = after",
            "check('the rows did not move while the preview ran', actualRows === expectedRows, String(actualRows.length))",
        ].join("\n"),
    },
    // CLASS 1 near-miss: the same pure function applied to two DIFFERENT receivers.
    {
        name: "live-pure-function-over-two-receivers",
        expect: "LIVE",
        body: [
            "declare function readRows(): readonly string[]",
            "const digest = (xs: readonly string[]) => xs.join('|')",
            "const before = readRows()",
            "const after = readRows()",
            "check('the digest did not move while the preview ran', digest(before) === digest(after), digest(after))",
        ].join("\n"),
    },
    // CLASS 2 near-miss: the shape root named explicitly as falsifiable. `ok` starts true and is set
    // false under a DATA-DEPENDENT guard that a stale row reaches, so a stale row turns the run red.
    {
        name: "live-boolean-set-false-under-a-reachable-guard",
        expect: "LIVE",
        body: [
            "declare const rows: ReadonlyArray<{ stale: boolean }>",
            "let ok = true",
            "for (const row of rows) { if (row.stale) { ok = false } }",
            "check('no stale row came back', ok, String(rows.length))",
        ].join("\n"),
    },
    // CLASS 3 near-miss: the pin is on the SOURCE of a length-preserving transformation, so it does
    // carry to the receiver. Reporting this would be the false positive that discredits the class.
    {
        name: "live-every-over-a-length-preserving-view",
        expect: "LIVE",
        body: [
            "declare const rows: ReadonlyArray<{ id: string }>",
            "const view = rows.map((r) => r.id)",
            "check('every id came back non-empty', rows.length > 0 && view.every((id) => id.length > 0), String(view.length))",
        ].join("\n"),
    },
    // CLASS 4 near-miss: the same replay loop with the collection pinned in the same condition, which
    // is exactly how check-retainer-runtime.ts:495 was hardened.
    {
        name: "live-replay-with-the-ledger-pinned",
        expect: "LIVE",
        body: [
            "declare const ledger: ReadonlyArray<{ delta: number }>",
            "let running = 0",
            "for (const row of ledger) { running += row.delta }",
            "check('the ledger replayed and the deltas net back to zero', ledger.length > 0 && running === 0, String(running))",
        ].join("\n"),
    },
    // CLASS 5 near-miss: the expected side is an INDEPENDENT statement of what the keys should be, so a
    // defect in the production constant moves one side only.
    {
        name: "live-expectation-independent-of-the-production-constant",
        expect: "LIVE",
        body: [
            "import { PERMISSION_KEYS } from '@/lib/permissions'",
            "check('the permission keys are exactly the four the UI ships', JSON.stringify(PERMISSION_KEYS) === JSON.stringify(['billing', 'members', 'settings', 'workspace']), 'keys')",
        ].join("\n"),
    },
    // CLASS 5 near-miss: the same derivation twice through a PROVEN-PURE local function, over a root
    // that is an OBSERVATION rather than a frozen import. Identical canonical text, identical purity;
    // only the provenance of the root differs, and that is the whole condition.
    {
        name: "live-mirrored-derivation-over-an-observed-root",
        expect: "LIVE",
        body: [
            "declare const observed: { rows: readonly string[] }",
            "const digest = (xs: readonly string[]) => xs.join('|')",
            "const before = digest(observed.rows)",
            "const after = digest(observed.rows)",
            "check('the preview wrote nothing', before === after, after)",
        ].join("\n"),
    },
    // CLASS 6 near-miss: two bounds on one subject where NEITHER forces the other, so both measure.
    {
        name: "live-two-independent-bounds-on-one-subject",
        expect: "LIVE",
        body: [
            "declare const posted: { status: number }",
            "check('the refusal is a 4xx and is not a 404', posted.status >= 400 && posted.status !== 404, String(posted.status))",
        ].join("\n"),
    },
    // CLASS 6 near-miss: a conjunct repeated around something that can MOVE the subject. The two
    // readings are two measurements, and the one in between is the thing under test.
    {
        name: "live-repeated-conjunct-around-an-effect",
        expect: "LIVE",
        body: [
            "declare function drain(): number",
            "declare const queue: { length: number }",
            "check('the queue drains and refills', queue.length > 0 && drain() === 0 && queue.length > 0, String(queue.length))",
        ].join("\n"),
    },
]

function fixtureSource(fixture: Fixture): string {
    return `${PRELUDE}\n${fixture.body}\n`
}

function fixtureNamed(name: string): Fixture {
    const found = VACUOUS_FIXTURES.find((fixture) => fixture.name === name)
    if (!found) throw new Error(`no fixture named ${name}`)
    return found
}

/**
 * MUTATION PROOFS. One per (detector, positive fixture): with the detector ON the fixture is flagged
 * with that class, and with the detector OFF the class DISAPPEARS from the same fixture.
 *
 * WHY THE SECOND HALF IS THE WHOLE POINT. "The fixture is flagged" is equally true of a fixture flagged
 * by some other class, or by an accident of precedence - and the six detectors here sit in a chain where
 * five of them could plausibly answer for another's shape. Turning one off and watching only ITS class
 * vanish is the only evidence that the detector is why the fixture is caught. Nothing is written to
 * disk and no mutation survives the call: `withDetectorDisabled` restores the prior state in a
 * `finally`, and the restoration is itself asserted after every proof.
 *
 * `EVERY_DOMINANCE` is proven the same way but reads differently: disabling it does not remove a
 * detector, it reverts the pin rule to the original walk, under which a pin under `||` or inside the
 * `every` callback is accepted. So its two fixtures stop being flagged when it is off - which is a
 * statement about the OLD rule, recorded here as a fixture rather than in a comment.
 */
const MUTATION_PROOFS: ReadonlyArray<Readonly<{ key: MutableDetector; fixture: string; expect: Classification }>> = [
    { key: "ALIAS_IDENTITY", fixture: "alias-identity-chain", expect: "VACUOUS_ALIAS_IDENTITY" },
    { key: "ALIAS_IDENTITY", fixture: "alias-identity-destructured", expect: "VACUOUS_ALIAS_IDENTITY" },
    { key: "ALIAS_IDENTITY", fixture: "alias-identity-pure-function-same-receiver", expect: "VACUOUS_ALIAS_IDENTITY" },
    { key: "UNREACHED_INITIALISER", fixture: "unreached-initialiser-never-written", expect: "VACUOUS_UNREACHED_INITIALISER" },
    { key: "UNREACHED_INITIALISER", fixture: "unreached-initialiser-dead-guard", expect: "VACUOUS_UNREACHED_INITIALISER" },
    { key: "EMPTY_REPLAY", fixture: "empty-replay-accumulator", expect: "VACUOUS_EMPTY_REPLAY" },
    { key: "MIRRORED_DERIVATION", fixture: "mirrored-derivation-imported-constant", expect: "VACUOUS_MIRRORED_DERIVATION" },
    { key: "MIRRORED_DERIVATION", fixture: "mirrored-derivation-copied-production-constant", expect: "VACUOUS_MIRRORED_DERIVATION" },
    { key: "DOMINATED_CONJUNCT", fixture: "dominated-conjunct-duplicate", expect: "VACUOUS_DOMINATED_CONJUNCT" },
    { key: "DOMINATED_CONJUNCT", fixture: "dominated-conjunct-entailed-bound", expect: "VACUOUS_DOMINATED_CONJUNCT" },
    { key: "DOMINATED_CONJUNCT", fixture: "dominated-conjunct-disjunction-forced-by-a-sibling", expect: "VACUOUS_DOMINATED_CONJUNCT" },
    { key: "EVERY_DOMINANCE", fixture: "every-pin-under-or", expect: "UNGUARDED_EVERY" },
    { key: "EVERY_DOMINANCE", fixture: "every-pin-inside-the-callback", expect: "UNGUARDED_EVERY" },
]

function runMutationProofs(): boolean {
    let ok = true
    // Every mutable key must be exercised, or a detector could be added to the switch and never proven.
    const covered = new Set(MUTATION_PROOFS.map((proof) => proof.key))
    const uncovered = MUTABLE_DETECTORS.filter((key) => !covered.has(key))
    if (!recordSelfCheck(uncovered.length === 0)) {
        console.error(`FAIL mutation-proof coverage: no proof for ${uncovered.join(", ")}, so those detectors are not shown to be load-bearing`)
        ok = false
    }
    for (const proof of MUTATION_PROOFS) {
        const fixture = fixtureNamed(proof.fixture)
        const source = fixtureSource(fixture)
        if (disabledDetectors.has(proof.key)) {
            console.log(`SKIP mutation-proof ${proof.key}/${proof.fixture}: the key is disabled for the whole run by --mutate-disable, and THIS RUN IS VOID`)
            continue
        }
        const normal = scan(`mutation-normal-${proof.fixture}.ts`, source)
        const before = normal.findings.filter((finding) => finding.classification === proof.expect)
        if (!recordSelfCheck(before.length > 0)) {
            console.error(`FAIL mutation-proof ${proof.key}/${proof.fixture}: ${proof.expect} is not reported with the detector ENABLED, so there is nothing to prove load-bearing`)
            ok = false
            continue
        }
        const mutated = withDetectorDisabled(proof.key, () => scan(`mutation-disabled-${proof.fixture}.ts`, source))
        const after = mutated.findings.filter((finding) => finding.classification === proof.expect)
        if (!recordSelfCheck(after.length === 0)) {
            console.error(
                `FAIL mutation-proof ${proof.key}/${proof.fixture}: ${proof.expect} is STILL reported with the detector disabled (${after.length} finding(s)), so the fixture is caught by something other than ${proof.key} and the class is not proven load-bearing`,
            )
            ok = false
            continue
        }
        if (!recordSelfCheck(detectorEnabled(proof.key))) {
            console.error(`FAIL mutation-proof ${proof.key}/${proof.fixture}: the detector was not restored after the mutation`)
            ok = false
            continue
        }
        const survivors = mutated.findings.map((finding) => finding.classification)
        console.log(
            `PASS mutation-proof ${proof.key}/${proof.fixture}: ${proof.expect} at fixture line ${before[0].line} with the detector enabled, GONE with it disabled (what remains: ${survivors.join(", ") || "nothing"}), detector restored`,
        )
    }
    return ok
}

/** The synthetic defect used by --prove-failure, so a clean tree can still be shown to exit 1. */
function controlledBadFixture(): ScanResult {
    return scan("controlled-bad-fixture.ts", fixtureSource(fixtureNamed("conditional-init")))
}

/**
 * ASSERTION EVIDENCE. This file is a SOURCE SCANNER: its "Assertion calls examined", "Per class: ..."
 * and "REAL vacuous assertions" lines count the CORPUS it scanned, never what it proved about itself,
 * so none of them is read as evidence. What this harness actually PROVES are its OWN gating invariants —
 * the --self-test fixtures (one vacuous case per class that MUST be caught, one live control per class
 * that must NOT be), the coverage-plumbing checks, and the inventory-reconciliation fixtures — now run
 * on every invocation. Each is recorded through `recordSelfCheck`, so the number is produced by the same
 * call that decides `selfTestOk`; it is never a literal (neutering the recorder collapses it), and a
 * failing self-check LOWERS `assertionsPassed` and exits non-zero. It counts NONE of the
 * UNGUARDED_EVERY / UNRESOLVED / candidate findings this scanner reports about OTHER files.
 */
let assertionsRun = 0
let assertionsPassed = 0

function recordSelfCheck(pass: boolean): boolean {
    assertionsRun += 1
    if (pass) assertionsPassed += 1
    return pass
}

function runSelfTest(): boolean {
    let ok = true
    for (const fixture of VACUOUS_FIXTURES) {
        const result = scan(`fixture-${fixture.name}.ts`, fixtureSource(fixture))
        const hit = result.findings.find((finding) => finding.classification === fixture.expect)
        recordSelfCheck(hit !== undefined)
        if (!hit) {
            const saw = result.findings.map((finding) => `${finding.classification}@${finding.line}`).join(", ") || "nothing"
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${saw}`)
            ok = false
            continue
        }
        console.log(`PASS self-test ${fixture.name}: ${fixture.expect} at fixture line ${hit.line}`)
    }
    for (const fixture of NON_DEFECT_FIXTURES) {
        const result = scan(`fixture-${fixture.name}.ts`, fixtureSource(fixture))
        const hit = result.findings.find((finding) => finding.classification === fixture.expect)
        recordSelfCheck(hit !== undefined)
        if (!hit) {
            const saw = result.findings.map((finding) => `${finding.classification}@${finding.line}`).join(", ") || "nothing"
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${saw}`)
            ok = false
            continue
        }
        // A non-defect fixture must ALSO not be counted as a defect, or the class boundary is fiction.
        const flagged = result.findings.filter((finding) => VACUOUS.includes(finding.classification))
        if (!recordSelfCheck(flagged.length === 0)) {
            console.error(
                `FAIL self-test ${fixture.name}: a non-defect fixture was ALSO counted as a defect: ${flagged.map((f) => `${f.classification}@${f.line}`).join(", ")}`,
            )
            ok = false
            continue
        }
        console.log(`PASS self-test ${fixture.name}: ${fixture.expect} at fixture line ${hit.line}, and not counted as a defect`)
    }
    for (const control of LIVE_CONTROLS) {
        const result = scan(`control-${control.name}.ts`, fixtureSource(control))
        const flagged = result.findings.filter((finding) => VACUOUS.includes(finding.classification))
        if (!recordSelfCheck(flagged.length === 0)) {
            console.error(
                `FAIL self-test ${control.name}: a LIVE control was flagged ${flagged.map((finding) => `${finding.classification}@${finding.line}`).join(", ")}`,
            )
            ok = false
            continue
        }
        console.log(`PASS self-test ${control.name}: live control not flagged (${result.assertionCount} assertion(s) parsed)`)
    }

    // Coverage plumbing, proven rather than asserted in a comment.
    const aliasResult = scan("coverage-alias.ts", fixtureSource(fixtureNamed("alias-followed")))
    if (!recordSelfCheck(aliasResult.discovery.aliases.length > 0)) {
        console.error("FAIL self-test coverage-alias: the alias fixture registered no alias, so alias following is not actually wired")
        ok = false
    } else {
        console.log(`PASS self-test coverage-alias: followed ${aliasResult.discovery.aliases.join("; ")}`)
    }
    const wrapperResult = scan("coverage-wrapper.ts", fixtureSource(fixtureNamed("forwarding-wrapper-followed")))
    if (!recordSelfCheck(wrapperResult.discovery.wrappers.length > 0)) {
        console.error("FAIL self-test coverage-wrapper: the wrapper fixture registered no wrapper, so wrapper following is not actually wired")
        ok = false
    } else {
        console.log(`PASS self-test coverage-wrapper: followed ${wrapperResult.discovery.wrappers.join("; ")}`)
    }

    // ---- the wrapper fixed point, proven by the ROUND each chain closes in ----------------------
    // This is the load-bearing part of the depth proof. The round number is recorded when a wrapper is
    // registered, and a loop bounded at two rounds cannot produce `(round 3)` or `(round 4)` at all -
    // so a fixture that reports one is a fixture the old bound could not have followed. Checking only
    // that the finding appears would be weaker: it would also pass for a fixture the old bound handled.
    for (const depth of [
        { fixture: "forwarding-wrapper-three-levels", outermost: "checkL3", round: 3, rounds: 4 },
        { fixture: "forwarding-wrapper-four-levels", outermost: "checkD4", round: 4, rounds: 5 },
    ]) {
        const result = scan(`coverage-wrapper-depth-${depth.round}.ts`, fixtureSource(fixtureNamed(depth.fixture)))
        const note = result.discovery.wrappers.find((wrapper) => wrapper.startsWith(`${depth.outermost} `))
        recordSelfCheck(note !== undefined && note.includes(`(round ${depth.round})`))
        if (!note || !note.includes(`(round ${depth.round})`)) {
            console.error(
                `FAIL self-test coverage-wrapper-depth-${depth.round}: expected \`${depth.outermost}\` to be registered in round ${depth.round}, saw ${result.discovery.wrappers.join("; ") || "no wrappers"}`,
            )
            ok = false
            continue
        }
        if (!recordSelfCheck(result.discovery.wrapperRounds === depth.rounds && !result.discovery.wrapperRoundsExhausted)) {
            console.error(
                `FAIL self-test coverage-wrapper-depth-${depth.round}: expected the fixed point in ${depth.rounds} round(s) with the safety bound untouched, saw ${result.discovery.wrapperRounds} round(s), exhausted=${String(result.discovery.wrapperRoundsExhausted)}`,
            )
            ok = false
            continue
        }
        const hit = result.findings.find((finding) => finding.classification === "VACUOUS_LITERAL")
        recordSelfCheck(hit !== undefined)
        if (!hit) {
            console.error(
                `FAIL self-test coverage-wrapper-depth-${depth.round}: the chain was registered but the assertion made through it was not classified, so the depth buys nothing`,
            )
            ok = false
            continue
        }
        console.log(
            `PASS self-test coverage-wrapper-depth-${depth.round}: ${note}, fixed point in ${result.discovery.wrapperRounds} round(s) inside the bound of ${MAX_WRAPPER_ROUNDS}, and the assertion made through the chain is caught (${hit.classification} at fixture line ${hit.line})`,
        )
    }

    // ---- the callsite-substitution pass, and the two things it must get right -------------------
    const builderResult = scan(
        "coverage-builder-callsite.ts",
        fixtureSource(fixtureNamed("callsite-derived-expectation-through-a-builder-wrapper")),
    )
    if (!recordSelfCheck(builderResult.builderCallsites > 0)) {
        console.error("FAIL self-test coverage-builder-callsite: no condition-building wrapper callsite was substituted, so the pass is not wired")
        ok = false
    }
    const lifted = builderResult.findings.find((finding) => finding.classification === "VACUOUS_DERIVED_EXPECTATION")
    recordSelfCheck(lifted !== undefined && lifted.evidence.startsWith("CALLSITE-DERIVED"))
    if (!lifted) {
        console.error("FAIL self-test coverage-builder-callsite: the callsite-derived expectation was not caught")
        ok = false
    } else if (!lifted.evidence.startsWith("CALLSITE-DERIVED")) {
        console.error(`FAIL self-test coverage-builder-callsite: the finding was not attributed to the callsite: ${lifted.evidence}`)
        ok = false
    } else {
        console.log(
            `PASS self-test coverage-builder-callsite: ${builderResult.builderNotes.join("; ")}, and the callsite-derived expectation is caught at fixture line ${lifted.line} (the callsite, not the wrapper body)`,
        )
    }
    if (!recordSelfCheck(builderResult.builderSkipped.length === 0)) {
        console.error(`FAIL self-test coverage-builder-callsite: substitution was skipped: ${builderResult.builderSkipped.join("; ")}`)
        ok = false
    }
    const rejectResult = scan("coverage-reject.ts", fixtureSource(
        LIVE_CONTROLS.find((control) => control.name === "live-wrapper-that-builds-its-own-condition") as Fixture,
    ))
    if (!recordSelfCheck(!rejectResult.discovery.wrappers.some((wrapper) => wrapper.startsWith("expectOrder")))) {
        console.error("FAIL self-test coverage-reject: a wrapper that BUILDS its condition was registered; the callsite argument is an array, and folding it would fabricate a defect")
        ok = false
    } else {
        console.log("PASS self-test coverage-reject: a condition-building wrapper was correctly NOT registered as a helper")
    }

    if (!runMutationProofs()) ok = false

    for (const fixture of INVENTORY_FIXTURES) {
        const found = reconcile(fixture.declared, fixture.onDisk)
        if (fixture.expect === null) {
            if (!recordSelfCheck(found.length === 0)) {
                console.error(`FAIL self-test ${fixture.name}: expected no finding, saw ${found.map((f) => f.kind).join(", ")}`)
                ok = false
                continue
            }
            console.log(`PASS self-test ${fixture.name}: nothing flagged, as required`)
            continue
        }
        if (!recordSelfCheck(found.some((finding) => finding.kind === fixture.expect))) {
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${found.map((f) => f.kind).join(", ") || "nothing"}`)
            ok = false
            continue
        }
        console.log(`PASS self-test ${fixture.name}: ${fixture.expect}`)
    }
    return ok
}

// ---------------------------------------------------------------------------------------------
// inventory, from the gate driver's manifest
// ---------------------------------------------------------------------------------------------

type IntegrityFinding = Readonly<{ kind: string; detail: string }>

type Manifest = Readonly<{ harnesses: ReadonlyArray<{ file: string }> }>

/**
 * Reconcile the declared inventory against disk. Pure, so the self-test can prove each kind fires.
 *
 * The point is not tidiness. A bare `readdirSync` cannot disagree with itself, so it can silently
 * scan a different set from the one `run-gates.js` runs, and then two green numbers would be about
 * two different populations. A harness present in one and absent from the other must be loud.
 */
function reconcile(declared: readonly string[], onDisk: readonly string[]): IntegrityFinding[] {
    const integrity: IntegrityFinding[] = []
    const sorted = [...declared].sort()
    const declaredSet = new Set(sorted)
    const diskSet = new Set(onDisk)
    for (const file of sorted) {
        if (!diskSet.has(file)) {
            integrity.push({
                kind: "MANIFEST_ENTRY_MISSING_ON_DISK",
                detail: `gates.manifest.json declares ${file}, which is not on disk; the manifest and the tree disagree.`,
            })
        }
    }
    for (const file of onDisk) {
        if (!declaredSet.has(file)) {
            integrity.push({
                kind: "ON_DISK_NOT_IN_MANIFEST",
                detail: `${file} exists but gates.manifest.json does not declare it, so the gate sweep would not run it while this scanner did. Add a manifest entry.`,
            })
        }
    }
    const duplicates = sorted.filter((file, index) => index > 0 && sorted[index - 1] === file)
    for (const file of new Set(duplicates)) {
        integrity.push({ kind: "DUPLICATE_MANIFEST_ENTRY", detail: `${file} is declared more than once in gates.manifest.json.` })
    }
    return integrity
}

const INVENTORY_FIXTURES: ReadonlyArray<Readonly<{
    name: string
    declared: readonly string[]
    onDisk: readonly string[]
    expect: string | null
}>> = [
    { name: "inventory-agreeing", declared: ["check-a.ts", "check-b.ts"], onDisk: ["check-a.ts", "check-b.ts"], expect: null },
    { name: "inventory-manifest-entry-missing", declared: ["check-a.ts", "check-gone.ts"], onDisk: ["check-a.ts"], expect: "MANIFEST_ENTRY_MISSING_ON_DISK" },
    { name: "inventory-on-disk-undeclared", declared: ["check-a.ts"], onDisk: ["check-a.ts", "check-new.ts"], expect: "ON_DISK_NOT_IN_MANIFEST" },
    { name: "inventory-duplicate-entry", declared: ["check-a.ts", "check-a.ts"], onDisk: ["check-a.ts"], expect: "DUPLICATE_MANIFEST_ENTRY" },
]

/** The declared harness list, reconciled against disk. Falls back to a listing only if unreadable. */
function manifestInventory(): Readonly<{ files: readonly string[]; integrity: IntegrityFinding[]; source: string }> {
    const onDisk = readdirSync(__dirname).filter((file) => /^check-.*\.ts$/u.test(file)).sort()
    if (!existsSync(MANIFEST_PATH)) {
        return {
            files: onDisk.filter((file) => file !== SELF_NAME),
            integrity: [{
                kind: "MANIFEST_UNREADABLE",
                detail: `${MANIFEST_PATH} does not exist, so this scan and run-gates.js can no longer be shown to cover the same set.`,
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
    return {
        files: declared.filter((file) => diskSet.has(file) && file !== SELF_NAME),
        integrity: reconcile(declared, onDisk),
        source: "scripts/gates/gates.manifest.json",
    }
}

// ---------------------------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2)
const quiet = argv.includes("--quiet")
const explicit: string[] = []
for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--file" && argv[index + 1]) {
        explicit.push(argv[index + 1])
        index += 1
    }
}

/**
 * `--mutate-disable=<KEY>` turns ONE detector off for the whole run, and makes the run VOID.
 *
 * This exists so a human can reproduce, from the command line, the mutation proofs that run in-process
 * on every invocation - and it is deliberately built so it can never be a way to get a green run. The
 * flag forces a non-zero exit whatever the findings are, prints a banner on every line of output that
 * summarises the run, and is refused for a key that is not in the switch (a typo silently disabling
 * nothing would be worse than an error). There is no environment variable and no config file: asking
 * for a mutation is the same as asking for exit 1.
 */
const mutationRequests = argv
    .filter((argument) => argument.startsWith("--mutate-disable="))
    .map((argument) => argument.slice("--mutate-disable=".length))
const unknownMutations = mutationRequests.filter(
    (key) => !(MUTABLE_DETECTORS as readonly string[]).includes(key),
)
if (unknownMutations.length > 0) {
    console.error(
        `REFUSING TO RUN: --mutate-disable was given ${unknownMutations.map((key) => `"${key}"`).join(", ")}, which name no detector. Valid keys: ${MUTABLE_DETECTORS.join(", ")}.`,
    )
    process.exit(1)
}
for (const key of mutationRequests) disabledDetectors.add(key as MutableDetector)
if (mutationRequests.length > 0) {
    console.log(
        `MUTATION RUN - THIS RUN IS VOID. Detector(s) disabled: ${mutationRequests.join(", ")}. Every finding below is what the scanner reports WITHOUT them, and the exit code is forced non-zero so a mutation can never be mistaken for a passing gate.`,
    )
}

const missing = explicit.filter((path) => !existsSync(path))
const declaredInventory = explicit.length > 0
    ? { files: [] as readonly string[], integrity: [] as IntegrityFinding[], source: "--file (explicit; inventory reconciliation skipped)" }
    : manifestInventory()
const targets = explicit.length > 0
    ? explicit.filter((path) => existsSync(path) && basename(path) !== SELF_NAME)
    : declaredInventory.files.map((file) => join(__dirname, file))

const results = targets.map((path) => scan(basename(path), readFileSync(path, "utf8")))
const proveFailure = argv.includes("--prove-failure")
if (proveFailure) results.push(controlledBadFixture())

const findings = results.flatMap((result) => result.findings)
const assertionTotal = results.reduce((sum, result) => sum + result.assertionCount, 0)
const helperNames = [...new Set(results.flatMap((result) => result.helpers))].sort()
const defects = findings.filter((finding) => VACUOUS.includes(finding.classification))
const unresolved = findings.filter((finding) => finding.classification === "UNRESOLVED")
const deliberate = findings.filter((finding) => finding.classification === "INTENTIONAL_FIXTURE_SELF_CHECK")

if (!quiet) {
    for (const finding of findings) {
        console.log(
            `${finding.classification} ${finding.file}:${finding.line} [${finding.helper}] ${finding.assertion}\n    conjunct: ${finding.conjunct}\n    why: ${finding.evidence}`,
        )
    }
}

for (const path of missing) console.log(`SKIPPED ${path}: file does not exist`)
console.log(
    `Inventory source: ${declaredInventory.source}. Scanned ${targets.length} file(s)${explicit.length > 0 ? " (explicit)" : ` in ${__dirname}`}, excluding ${SELF_NAME}: its detector logic and its fixtures necessarily contain every shape it hunts.`,
)
console.log(`Assertion helpers in use: ${helperNames.join(", ")}. Assertion calls examined: ${assertionTotal}.`)

// ---- how the helper set was arrived at, per path, so no coverage claim rests on a hardcoded name --
const directNames = [...new Set(results.flatMap((result) => [...result.discovery.direct]))].sort()
const wrapperNotes = new Map<string, number>()
for (const result of results) {
    for (const wrapper of result.discovery.wrappers) wrapperNotes.set(wrapper, (wrapperNotes.get(wrapper) ?? 0) + 1)
}
const aliasNotes = results.flatMap((result) => result.discovery.aliases)
const fallbackNotes = new Map<string, number>()
for (const result of results) {
    for (const name of result.discovery.fallbackUsed) fallbackNotes.set(name, (fallbackNotes.get(name) ?? 0) + 1)
}
console.log(`  discovered directly (declared, records a verdict): ${directNames.join(", ") || "none"}.`)
console.log(
    `  discovered as condition-forwarding wrappers: ${wrapperNotes.size > 0 ? [...wrapperNotes].sort().map(([note, count]) => `${note} in ${count} file(s)`).join("; ") : "none"}.`,
)
console.log(`  discovered as direct aliases: ${aliasNotes.length > 0 ? aliasNotes.join("; ") : "none present in this tree"}.`)
console.log(
    `  covered ONLY by the hardcoded fallback (a discovery miss, not a pass): ${fallbackNotes.size > 0 ? [...fallbackNotes].sort().map(([name, count]) => `${name} in ${count} file(s)`).join("; ") : "none"}.`,
)
const builderNotes = new Map<string, number>()
for (const result of results) {
    for (const note of result.builderNotes) builderNotes.set(note, (builderNotes.get(note) ?? 0) + 1)
}
const builderSkipped = [...new Set(results.flatMap((result) => result.builderSkipped))]
const builderCallsiteTotal = results.reduce((sum, result) => sum + result.builderCallsites, 0)
console.log(
    `  condition-BUILDING wrappers, callsite arguments substituted into the wrapper's own condition (${builderCallsiteTotal} callsite(s)): ${builderNotes.size > 0 ? [...builderNotes].sort().map(([note, count]) => `${note} [${count} file(s)]`).join("; ") : "none"}.`,
)
console.log(
    `  builder callsites NOT substituted: ${builderSkipped.length > 0 ? builderSkipped.join("; ") : "none"}.`,
)
const roundsUsed = Math.max(0, ...results.map((result) => result.discovery.wrapperRounds))
const exhausted = results.filter((result) => result.discovery.wrapperRoundsExhausted)
console.log(
    `  wrapper discovery ran to a fixed point: deepest file needed ${roundsUsed} round(s), safety bound ${MAX_WRAPPER_ROUNDS}, files that hit the bound without converging: ${exhausted.length}.`,
)
for (const result of exhausted) {
    console.log(
        `INTEGRITY WRAPPER_DISCOVERY_TRUNCATED: ${result.discovery.wrapperRounds} rounds of wrapper discovery still registered new helpers when the safety bound was reached, so the helper set for a file may be incomplete and assertions made through the deepest wrappers may be unscanned. Raise MAX_WRAPPER_ROUNDS or find the cycle.`,
    )
}
console.log(`  NOT followed: ${COVERAGE_LIMITS.map((item, index) => `(${index + 1}) ${item}`).join(" ")}`)
console.log(
    `  NOT DECIDED by the falsifiability classes: ${FALSIFIABILITY_LIMITS.map((item, index) => `(${index + 1}) ${item}`).join(" ")}`,
)
const perClass = VACUOUS.map(
    (classification) => `${classification}=${findings.filter((finding) => finding.classification === classification).length}`,
).join("; ")
console.log(`Per class: ${perClass}; INTENTIONAL_FIXTURE_SELF_CHECK=${deliberate.length}; UNRESOLVED=${unresolved.length}.`)
console.log(`REAL vacuous assertions (cannot fail): ${defects.length}.`)

/**
 * WHAT GATES, AND WHY IT IS NOT EVERYTHING.
 *
 * The three SERIOUS classes gate: CONDITIONAL_INIT, SELF_COMPARISON and DERIVED_EXPECTATION. Each is an
 * assertion that reads as a measurement while being incapable of failing, and each has now been found
 * in real committed harnesses in this repository and fixed - so they are actionable, bounded, and must
 * not come back. LITERAL and TAUTOLOGY gate too; there are currently none.
 *
 * UNGUARDED_EVERY does NOT gate, and that is a deliberate decision rather than an oversight. Gating on
 * them would make this scanner permanently red on arrival, which turns a new control into a disabled
 * one - and this repository has already shipped "a control wired to nothing" once. They are printed
 * with a count so the debt is visible and cannot quietly grow.
 *
 * THE FIVE FALSIFIABILITY CLASSES DO NOT GATE EITHER, ON ARRIVAL, for exactly that precedent and for
 * one more reason: they are new, and a class that turns the tree red the day it lands is a class
 * someone deletes rather than a defect someone fixes. They ARE counted as defects, printed
 * individually with their evidence, and each is proven load-bearing by a mutation on every run, so the
 * debt is visible and measured. MEASURED at arrival: 2 VACUOUS_DOMINATED_CONJUNCT
 * (check-appointment-authz.ts:245, a conjunct written twice; check-due-work-preview-api.ts:603, where
 * `=== 405` already forces `!== 200`) and 0 of the other four. Promoting a class into GATING is the
 * integration owner's call, not this file's, and the right moment is when its count is 0.
 *
 * THE COUNT MOVES, AND THAT IS THE POINT. It was 47 when this scanner landed; 8 at Q2-A, after the
 * intervening work cleared most of them and Q1's `check-operations-runtime.ts` rewrite added five new
 * ones. Every surviving case is triaged INDIVIDUALLY in the Q2-A report - three long-standing and five
 * introduced by Q1 - because a bulk justification for this class is indistinguishable from ignoring it.
 * Do not update this paragraph with a new number; read the count off a run.
 *
 * If the debt is ever cleared, move UNGUARDED_EVERY into GATING and delete this comment.
 */
const GATING: readonly Finding["classification"][] = [
    "VACUOUS_LITERAL",
    "VACUOUS_TAUTOLOGY",
    "VACUOUS_CONDITIONAL_INIT",
    "VACUOUS_SELF_COMPARISON",
    "VACUOUS_DERIVED_EXPECTATION",
]
const gatingDefects = defects.filter((finding) => GATING.includes(finding.classification))
const reportedOnly = defects.filter((finding) => !GATING.includes(finding.classification))
const reportedOnlyClasses = [...new Set(reportedOnly.map((finding) => finding.classification))].sort()
console.log(
    `Gating classes: ${gatingDefects.length} defect(s). Reported-only (counted, printed with evidence, but not gating on arrival - see the comment above): ${reportedOnly.length}${reportedOnlyClasses.length > 0 ? ` (${reportedOnlyClasses.join(", ")})` : ""}.`,
)

// This scanner's OWN gating invariants (its controlled fixtures + inventory reconciliation) now run on
// EVERY invocation, not only under --self-test, so it emits a real assertion-evidence count instead of
// leaning on exit 0 alone. --self-test remains accepted (now the default) for backward compatibility.
const selfTestOk = runSelfTest()

for (const problem of declaredInventory.integrity) console.log(`INTEGRITY ${problem.kind}: ${problem.detail}`)
console.log(`Inventory integrity findings: ${declaredInventory.integrity.length}.`)

// Machine-readable assertion evidence for scripts/gates/run-gates.js. The identity-bearing line must be
// the WHOLE line and name this EXACT file, or the driver reports EVIDENCE_IDENTITY_MISMATCH. Both numbers
// come from recordSelfCheck() — the same calls that feed selfTestOk — so they cannot exceed what actually
// ran and collapse to 0 if the recorder is neutered. This counts ONLY this scanner's own gating
// invariants, never the vacuity findings it reports about other files.
console.log(`GATE-EVIDENCE harness=check-assertion-vacuity.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} invariants passed`)

if (mutationRequests.length > 0) {
    console.log(
        `MUTATION RUN - THIS RUN IS VOID: ${mutationRequests.join(", ")} was disabled, so the counts above are not a measurement of this tree and the exit code below is forced to 1.`,
    )
    process.exitCode = 1
}

if (gatingDefects.length > 0 || !selfTestOk || missing.length > 0 || declaredInventory.integrity.length > 0 || exhausted.length > 0) {
    process.exitCode = 1
}
