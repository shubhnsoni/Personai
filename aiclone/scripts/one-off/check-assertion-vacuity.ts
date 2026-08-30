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

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import ts from "typescript"

type Classification =
    | "VACUOUS_LITERAL"
    | "VACUOUS_TAUTOLOGY"
    | "VACUOUS_CONDITIONAL_INIT"
    | "VACUOUS_SELF_COMPARISON"
    | "VACUOUS_DERIVED_EXPECTATION"
    | "UNGUARDED_EVERY"
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

const SELF_NAME = "check-assertion-vacuity.ts"

/** Classes that mean "this assertion cannot fail", i.e. a real defect. */
const VACUOUS: readonly Classification[] = [
    "VACUOUS_LITERAL",
    "VACUOUS_TAUTOLOGY",
    "VACUOUS_CONDITIONAL_INIT",
    "VACUOUS_SELF_COMPARISON",
    "VACUOUS_DERIVED_EXPECTATION",
    "UNGUARDED_EVERY",
]

/**
 * Helper names seen across this repository's harnesses, with the argument index that carries the
 * condition. This is a FALLBACK: the real set is discovered per file from the AST, because the
 * parameter is variously named condition / pass / ok / observed / expectation and the exit-integrity
 * scanner's hardcoded set contains three names (`expect`, `mustAllow`, `mustRefuse`) that have zero
 * callsites in this tree while missing the `observed`/`expectation` variants that do exist.
 */
const FALLBACK_HELPERS: ReadonlyMap<string, number> = new Map([
    ["check", 1],
    ["checkInvertible", 1],
    ["assert", 0],
])

/** Parameter names this repository actually uses for "the thing that must be true". */
const CONDITION_PARAMETERS = new Set(["condition", "pass", "passed", "ok", "holds", "observed", "expectation", "truth"])

/** Roots that carry no observation of their own, so sharing one proves nothing about derivation. */
const BUILTIN_ROOTS = new Set([
    "Object", "JSON", "Array", "Number", "String", "Boolean", "Math", "Date", "Set", "Map", "RegExp",
    "Promise", "Symbol", "BigInt", "Error", "process", "console", "globalThis", "undefined", "NaN",
    "Infinity", "ts", "prisma", "require", "module", "exports",
])

/** Words that, in an assertion name or its leading comment, are evidence of a deliberate fixture check. */
const FIXTURE_EVIDENCE = /\b(?:fixture|deliberate(?:ly)?|on purpose|by construction|sanity|self-test|selftest|control|controlled|precondition|smoke|tautolog\w*|placeholder|scaffold)\b/iu

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
        if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            return /result|failure|assertion|coverage|verdict/iu.test(candidate.left.getText())
        }
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

/**
 * The assertion helpers this file actually defines, with the index of the condition argument.
 * Discovered from the AST so a helper with an unusual parameter name is not missed, then merged
 * with the fallback set so a file that imports its helper is still covered.
 */
function discoverHelpers(source: ts.SourceFile): Map<string, number> {
    const helpers = new Map<string, number>()
    walk(source, (node) => {
        let name: string | undefined
        let parameters: ts.NodeArray<ts.ParameterDeclaration> | undefined
        let body: ts.Node | undefined
        if (ts.isFunctionDeclaration(node) && node.name) {
            name = node.name.text
            parameters = node.parameters
            body = node.body
        } else if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
            name = node.name.text
            parameters = node.initializer.parameters
            body = node.initializer.body
        }
        if (!name || !parameters) return
        const index = conditionParameterIndex(parameters)
        if (index < 0) return
        if (!recordsVerdict(body)) return
        const existing = helpers.get(name)
        if (existing === undefined || existing === index) helpers.set(name, index)
    })
    for (const [name, index] of FALLBACK_HELPERS) if (!helpers.has(name)) helpers.set(name, index)
    return helpers
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
    /** `true` when the binding is `const`, or a `let` never reassigned. */
    stable: boolean
    assignments: readonly ts.BinaryExpression[]
    declaration: ts.VariableDeclaration
}>

/** Every simple `const`/`let x = init` binding in the file, with its reassignments counted. */
function buildDefinitions(source: ts.SourceFile): Map<string, Definition> {
    const declarations = new Map<string, ts.VariableDeclaration>()
    const assignments = new Map<string, ts.BinaryExpression[]>()
    walk(source, (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            // A name declared twice in one file cannot be resolved without full scope analysis;
            // drop it rather than resolve it to the wrong binding.
            if (declarations.has(node.name.text)) declarations.set(node.name.text, node)
            else declarations.set(node.name.text, node)
        }
        if (
            ts.isBinaryExpression(node)
            && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isIdentifier(node.left)
        ) {
            const list = assignments.get(node.left.text) ?? []
            list.push(node)
            assignments.set(node.left.text, list)
        }
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
            stable: reassignments.length === 0,
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

/** Class: `arr.every(...)` with nothing establishing that `arr` is non-empty. `[].every` is true. */
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
        const own: ts.Node[] = [whole, ...guardsOf(assertion)]
        if (own.some((scope) => hasNonEmptyGuard(context, scope, receiverText, assertion))) continue

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

type ScanResult = Readonly<{ findings: readonly Finding[]; assertionCount: number; helpers: readonly string[] }>

function scan(file: string, text: string): ScanResult {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const helpers = discoverHelpers(source)
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

    const context: Context = { file, source, definitions, facts, assertions, helpers, imported: importedNames(source) }
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
            const verdict = detectLiteral(context, conjunct, assertion)
                ?? detectTautology(context, conjunct)
                ?? detectSelfComparison(context, conjunct)
                ?? detectDerivedExpectation(context, conjunct)
                ?? detectConditionalInit(context, conjunct, parts)
                ?? detectUnguardedEvery(context, conjunct, condition, assertion)
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

    return { findings, assertionCount: assertions.length, helpers: [...helpers.keys()].sort() }
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
]

function fixtureSource(fixture: Fixture): string {
    return `${PRELUDE}\n${fixture.body}\n`
}

/** The synthetic defect used by --prove-failure, so a clean tree can still be shown to exit 1. */
function controlledBadFixture(): ScanResult {
    return scan("controlled-bad-fixture.ts", fixtureSource(VACUOUS_FIXTURES[6]))
}

function runSelfTest(): boolean {
    let ok = true
    for (const fixture of VACUOUS_FIXTURES) {
        const result = scan(`fixture-${fixture.name}.ts`, fixtureSource(fixture))
        const hit = result.findings.find((finding) => finding.classification === fixture.expect)
        if (!hit) {
            const saw = result.findings.map((finding) => `${finding.classification}@${finding.line}`).join(", ") || "nothing"
            console.error(`FAIL self-test ${fixture.name}: expected ${fixture.expect}, saw ${saw}`)
            ok = false
            continue
        }
        console.log(`PASS self-test ${fixture.name}: ${fixture.expect} at fixture line ${hit.line}`)
    }
    for (const control of LIVE_CONTROLS) {
        const result = scan(`control-${control.name}.ts`, fixtureSource(control))
        const flagged = result.findings.filter((finding) => VACUOUS.includes(finding.classification))
        if (flagged.length > 0) {
            console.error(
                `FAIL self-test ${control.name}: a LIVE control was flagged ${flagged.map((finding) => `${finding.classification}@${finding.line}`).join(", ")}`,
            )
            ok = false
            continue
        }
        console.log(`PASS self-test ${control.name}: live control not flagged (${result.assertionCount} assertion(s) parsed)`)
    }
    return ok
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

const missing = explicit.filter((path) => !existsSync(path))
const targets = explicit.length > 0
    ? explicit.filter((path) => existsSync(path) && basename(path) !== SELF_NAME)
    : readdirSync(__dirname)
        .filter((file) => /^check-.*\.ts$/u.test(file) && file !== SELF_NAME)
        .sort()
        .map((file) => join(__dirname, file))

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
    `Scanned ${targets.length} file(s)${explicit.length > 0 ? " (explicit)" : ` in ${__dirname}`}, excluding ${SELF_NAME}: its detector logic and its fixtures necessarily contain every shape it hunts.`,
)
console.log(`Assertion helpers in use: ${helperNames.join(", ")}. Assertion calls examined: ${assertionTotal}.`)
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
 * UNGUARDED_EVERY does NOT gate, and that is a deliberate decision rather than an oversight. There are
 * 47 of them, they predate this scanner, and 9 are already mitigated at suite level by a sibling
 * assertion that pins the collection's length. Gating on them would make this scanner permanently red
 * on arrival, which turns a new control into a disabled one - and this repository has already shipped
 * "a control wired to nothing" once. They are printed with a count so the debt is visible and cannot
 * quietly grow, and the count belongs in the run's documentation as owed work.
 *
 * If that debt is ever cleared, move UNGUARDED_EVERY into GATING and delete this comment.
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
console.log(
    `Gating classes: ${gatingDefects.length} defect(s). Reported-only (UNGUARDED_EVERY, pre-existing debt): ${reportedOnly.length}.`,
)

const selfTestOk = argv.includes("--self-test") ? runSelfTest() : true

if (gatingDefects.length > 0 || !selfTestOk || missing.length > 0) process.exitCode = 1
