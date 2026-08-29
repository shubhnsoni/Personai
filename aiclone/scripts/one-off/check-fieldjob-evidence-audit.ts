import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import ts from "typescript"

const INVERT = process.env.INVERT_ASSERTION === "1"
const ROOT = resolve(process.cwd())

const TARGETS = {
    schema: join(ROOT, "scripts/one-off/check-fieldjob-schema-invariants.ts"),
    runtime: join(ROOT, "scripts/one-off/check-fieldjob-runtime.ts"),
    routes: join(ROOT, "scripts/one-off/check-fieldjob-routes.ts"),
} as const

type TargetName = keyof typeof TARGETS
type Result = { name: string; pass: boolean; detail: string }

const results: Result[] = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    check(name, INVERT ? !pass : pass, detail)
}

const configPath = join(ROOT, "scripts/tsconfig.checks.json")
const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
}
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath), { noEmit: true }, configPath)
const targetPaths = Object.values(TARGETS).map((value) => resolve(value))
const program = ts.createProgram({ rootNames: targetPaths, options: parsedConfig.options })
const checker = program.getTypeChecker()

function sourceFor(name: TargetName): ts.SourceFile {
    const expected = resolve(TARGETS[name]).toLowerCase()
    const source = program.getSourceFiles().find((candidate) => resolve(candidate.fileName).toLowerCase() === expected)
    if (!source) throw new Error(`TypeScript did not load ${TARGETS[name]}`)
    return source
}

const sources = Object.fromEntries(
    (Object.keys(TARGETS) as TargetName[]).map((name) => [name, sourceFor(name)]),
) as Record<TargetName, ts.SourceFile>
const texts = Object.fromEntries(
    (Object.keys(TARGETS) as TargetName[]).map((name) => [name, readFileSync(TARGETS[name], "utf8")]),
) as Record<TargetName, string>

function lineOf(source: ts.SourceFile, node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function visit(source: ts.Node, inspect: (node: ts.Node) => void) {
    const walk = (node: ts.Node) => {
        inspect(node)
        ts.forEachChild(node, walk)
    }
    walk(source)
}

function isNamedCall(node: ts.Node, name: string): node is ts.CallExpression {
    return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
}

function checkName(call: ts.CallExpression): string | null {
    const first = call.arguments[0]
    return first && ts.isStringLiteralLike(first) ? first.text : null
}

function namedCheck(source: ts.SourceFile, name: string): ts.CallExpression | null {
    let found: ts.CallExpression | null = null
    visit(source, (node) => {
        if ((isNamedCall(node, "check") || isNamedCall(node, "checkInvertible")) && checkName(node) === name) found = node
    })
    return found
}

function isPromiseLike(type: ts.Type): boolean {
    if (type.isUnionOrIntersection()) return type.types.some(isPromiseLike)
    return checker.getPropertyOfType(type, "then") !== undefined
}

function hasFunctionAncestor(node: ts.Node): boolean {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isFunctionLike(current)) return true
    }
    return false
}

function containsNode(node: ts.Node, predicate: (candidate: ts.Node) => boolean): boolean {
    let found = false
    const walk = (candidate: ts.Node) => {
        if (found) return
        if (predicate(candidate)) {
            found = true
            return
        }
        ts.forEachChild(candidate, walk)
    }
    walk(node)
    return found
}

function hasPositiveLengthGuard(node: ts.Node): boolean {
    return containsNode(node, (candidate) => {
        if (!ts.isBinaryExpression(candidate)) return false
        const leftLength = ts.isPropertyAccessExpression(candidate.left) && candidate.left.name.text === "length"
        const rightLength = ts.isPropertyAccessExpression(candidate.right) && candidate.right.name.text === "length"
        const leftZero = ts.isNumericLiteral(candidate.left) && candidate.left.text === "0"
        const rightZero = ts.isNumericLiteral(candidate.right) && candidate.right.text === "0"
        return (
            (leftLength && rightZero && candidate.operatorToken.kind === ts.SyntaxKind.GreaterThanToken) ||
            (leftZero && rightLength && candidate.operatorToken.kind === ts.SyntaxKind.LessThanToken)
        )
    })
}

function conditionMentions(node: ts.Node, names: readonly string[]): boolean {
    return containsNode(node, (candidate) => ts.isIdentifier(candidate) && names.includes(candidate.text))
}

for (const [name, source] of Object.entries(sources) as Array<[TargetName, ts.SourceFile]>) {
    const syntaxErrors = program.getSyntacticDiagnostics(source)
    check(`${name}: source parses without syntax errors`, syntaxErrors.length === 0, syntaxErrors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; "))

    const asyncEvery: string[] = []
    const promiseConditions: string[] = []
    const unawaitedAsyncStatements: string[] = []

    visit(source, (node) => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "every"
        ) {
            const callback = node.arguments[0]
            if (
                callback &&
                (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
                callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
            ) {
                asyncEvery.push(`${name}:${lineOf(source, node)}`)
            }
        }

        if (isNamedCall(node, "check") || isNamedCall(node, "checkInvertible")) {
            const condition = node.arguments[1]
            if (condition && isPromiseLike(checker.getTypeAtLocation(condition))) {
                promiseConditions.push(`${name}:${lineOf(source, condition)} ${checkName(node) ?? "unnamed check"}`)
            }
        }

        if (ts.isExpressionStatement(node) && hasFunctionAncestor(node) && isPromiseLike(checker.getTypeAtLocation(node.expression))) {
            unawaitedAsyncStatements.push(`${name}:${lineOf(source, node)} ${node.getText(source).slice(0, 100)}`)
        }
    })

    check(`${name}: no async predicate is passed to Array.every`, asyncEvery.length === 0, asyncEvery.join(", "))
    check(`${name}: no check condition is Promise-like`, promiseConditions.length === 0, promiseConditions.join("; "))
    check(`${name}: no Promise-like expression statement is left unawaited inside a function`, unawaitedAsyncStatements.length === 0, unawaitedAsyncStatements.join("; "))
}

const schemaRefuses = sources.schema.statements.find(
    (statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === "refuses",
)
let refusalCatchAssignments = 0
if (schemaRefuses) {
    visit(schemaRefuses, (node) => {
        if (!ts.isCatchClause(node)) return
        if (
            containsNode(
                node.block,
                (candidate) =>
                    ts.isBinaryExpression(candidate) &&
                    candidate.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                    ts.isIdentifier(candidate.left) &&
                    candidate.left.text === "refused" &&
                    candidate.right.kind === ts.SyntaxKind.TrueKeyword,
            )
        ) {
            refusalCatchAssignments += 1
        }
    })
}
check(
    "schema: setup or transaction failures are not classified as the expected refusal",
    schemaRefuses !== undefined && refusalCatchAssignments === 1,
    `catch blocks assigning refused=true: ${refusalCatchAssignments}; expected only the body-under-test catch`,
)

const schemaRefusalChecks = [
    "a request with a negative estimate is refused",
    "a job with a start and no end is refused, because it has no duration",
    "a job with an end and no start is refused too",
    "a job that ends before it starts is refused",
    "declining an assignment without saying why is refused - an unexplained refusal reads as a mistake later",
    "releasing with a whitespace-only reason is refused, not just a NULL one",
    "a second active LEAD on one job is refused, because two leads means nobody is accountable",
    "assigning the same technician to the same job twice while both are active is refused",
    "assigning another profile's technician is refused by trigger, so tenant isolation is a database rule too",
    "one request cannot convert into two jobs",
    "two jobs cannot share a reference within a profile",
    "the database refuses to rewrite a job event",
    "the database refuses to erase a job event",
] as const
for (const assertionName of schemaRefusalChecks) {
    const call = namedCheck(sources.schema, assertionName)
    const condition = call?.arguments[1]
    check(
        `schema: refusal assertion identifies the expected database rule: ${assertionName}`,
        condition !== undefined && conditionMentions(condition, ["detail", "code", "constraint"]),
        call ? `schema:${lineOf(sources.schema, call)} condition is ${condition?.getText(sources.schema) ?? "missing"}` : "assertion missing",
    )
}

const runtimeRewrite = namedCheck(sources.runtime, "the database refuses to rewrite the job history")
check(
    "runtime: append-only refusal identifies the expected error rather than accepting any throw",
    runtimeRewrite !== null && runtimeRewrite.arguments[1] !== undefined && conditionMentions(runtimeRewrite.arguments[1], ["message", "code"]),
    runtimeRewrite ? `runtime:${lineOf(sources.runtime, runtimeRewrite)} condition is ${runtimeRewrite.arguments[1]?.getText(sources.runtime)}` : "assertion missing",
)

const filtered = namedCheck(sources.routes, "a valid status filter is applied")
check(
    "routes: status-filter assertion proves at least one result was filtered",
    filtered !== null && filtered.arguments[1] !== undefined && hasPositiveLengthGuard(filtered.arguments[1]),
    filtered ? `routes:${lineOf(sources.routes, filtered)} has no positive length guard` : "assertion missing",
)

const loadBearing: Record<TargetName, readonly string[]> = {
    schema: [
        "FieldJobAssignment.resourceId points at the pre-existing AppointmentResource",
        "assigning another profile's technician is refused by trigger, so tenant isolation is a database rule too",
        "the database refuses to rewrite a job event",
        "harness left zero residue",
    ],
    runtime: [
        "MEASURED: a job cannot be dispatched with nobody assigned - a status table alone would allow it",
        "MEASURED: work cannot start until a technician is actually on site",
        "MEASURED: a job is not complete while a technician is still mid-visit, and the refusal names how many",
        "a foreign technician and a nonexistent one produce byte-identical refusals",
        "a foreign job and a nonexistent one produce byte-identical refusals",
        "zero external calls were made by the fieldJobs runtime",
    ],
    routes: [
        "MEASURED: an unrecognised request status is 400, because the vocabulary check runs before the state machine",
        "MEASURED: a recognised status in the wrong order is 409 - same field, two different answers",
        "MEASURED: a request cannot claim to be the CUSTOMER - only STAFF and TECHNICIAN are accepted",
        "MEASURED: a job still cannot be dispatched with nobody assigned - the side condition is not bypassed by the route",
        "MEASURED: a foreign technician and a nonexistent one are BYTE-IDENTICAL",
        "MEASURED: a foreign job and a nonexistent job are BYTE-IDENTICAL",
        "MEASURED: the 503 body leaks no DSN, host or driver text",
    ],
}
for (const [target, assertionNames] of Object.entries(loadBearing) as Array<[TargetName, readonly string[]]>) {
    for (const assertionName of assertionNames) {
        let call = namedCheck(sources[target], assertionName)
        if (call === null && assertionName === "FieldJobAssignment.resourceId points at the pre-existing AppointmentResource") {
            visit(sources.schema, (node) => {
                if (
                    (isNamedCall(node, "check") || isNamedCall(node, "checkInvertible")) &&
                    node.arguments[0]?.getText(sources.schema).includes("points at the pre-existing")
                ) {
                    call = node
                }
            })
        }
        check(
            `${target}: load-bearing assertion is inversion-covered: ${assertionName}`,
            call !== null && ts.isIdentifier(call.expression) && call.expression.text === "checkInvertible",
            call ? `${target}:${lineOf(sources[target], call)} uses ${call.expression.getText(sources[target])}` : "assertion missing",
        )
    }
}

const runtimeValueImports = sources.runtime.statements.filter((statement): statement is ts.ImportDeclaration => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return false
    if (!statement.moduleSpecifier.text.includes("src/lib/fieldjobs")) return false
    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) return false
    if (clause.name) return true
    return clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings) || clause.namedBindings.elements.some((element) => !element.isTypeOnly)
})
check(
    "runtime: fetch blocker is installed before code-under-test modules evaluate",
    runtimeValueImports.length === 0,
    runtimeValueImports.map((node) => `runtime:${lineOf(sources.runtime, node)} ${node.moduleSpecifier.getText(sources.runtime)}`).join(", "),
)

const routeForeignJob = texts.routes.indexOf("const foreignJob = await call(api.getJob")
const routeSwitchToB = texts.routes.indexOf("identity.current = `clerk_${ids.userB}`")
check(
    "routes: foreign-job non-enumeration reaches job ownership under tenant B",
    routeSwitchToB >= 0 && routeForeignJob >= 0 && routeSwitchToB < routeForeignJob,
    "identity switches to user B only after the foreign/ghost job comparison, so both requests can fail at workspace authorization",
)
check(
    "runtime: foreign-job comparison uses serialized envelopes",
    texts.runtime.includes("envelope(foreignJob) === envelope(ghostJob)"),
)
check(
    "routes: foreign-job comparison uses serialized response bytes",
    texts.routes.includes("refusal(foreignJob) === refusal(ghostJob)"),
)
check(
    "runtime: foreign technician is seeded under profile B",
    texts.runtime.includes("[ids.techB, ids.profileB, true]"),
)
check(
    "routes: foreign technician is seeded under profile B",
    texts.routes.includes("[ids.techB, ids.profileB]"),
)
check(
    "schema: foreign technician is seeded under profile B",
    texts.schema.includes('[q("tb"), q("prb")]'),
)

for (const target of ["runtime", "routes"] as const) {
    let unsafeTriggerTry: ts.TryStatement | null = null
    visit(sources[target], (node) => {
        if (
            ts.isTryStatement(node) &&
            node.getText(sources[target]).includes('disable trigger "FieldJobEvent_append_only"') &&
            node.getText(sources[target]).includes('enable trigger "FieldJobEvent_append_only"') &&
            !node.finallyBlock
        ) {
            unsafeTriggerTry = node
        }
    })
    check(
        `${target}: teardown structurally guarantees the append-only trigger is re-enabled`,
        unsafeTriggerTry === null,
        unsafeTriggerTry ? `${target}:${lineOf(sources[target], unsafeTriggerTry)} disable/enable share a try with no finally` : "",
    )
}

checkInvertible("audit self-test: all three target harnesses were loaded", Object.keys(sources).length === 3)

const failed = results.filter((result) => !result.pass)
for (const result of results) {
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  (${result.detail})` : ""}`)
}
console.log(`\n${results.length - failed.length}/${results.length} evidence-audit assertions passed`)
if (INVERT) console.log("INVERT_ASSERTION=1 was set - the audit self-test failure is expected")
if (failed.length) process.exit(1)
console.log("All FieldJobs evidence harness anti-pattern checks passed.")
