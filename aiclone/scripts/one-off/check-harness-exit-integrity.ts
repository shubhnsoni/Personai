import { readdirSync, readFileSync } from "node:fs"
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

const ASSERTION_NAMES = new Set(["assert", "check", "checkInvertible", "expect", "mustAllow", "mustRefuse", "refuses"])
const SELF_NAME = "check-harness-exit-integrity.ts"

function lineOf(source: ts.SourceFile, node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function propertyName(node: ts.Expression): string | null {
    return ts.isPropertyAccessExpression(node) ? node.name.text : null
}

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

function isAssertion(node: ts.Node): boolean {
    if (!ts.isCallExpression(node)) return false
    if (ts.isIdentifier(node.expression)) return ASSERTION_NAMES.has(node.expression.text)
    return ts.isPropertyAccessExpression(node.expression) && ASSERTION_NAMES.has(node.expression.name.text)
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

function analyze(file: string, text: string): Finding[] {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const assertions: ts.Node[] = []
    const exits: ts.Node[] = []
    const summaries: ts.Node[] = []

    const visit = (node: ts.Node) => {
        if (isAssertion(node)) assertions.push(node)
        if (isProcessExit(node) || isProcessExitCodeAssignment(node)) exits.push(node)
        if (isVerdictAssignment(node)) summaries.push(node)
        ts.forEachChild(node, visit)
    }
    visit(source)

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

    return findings
}

function printFinding(finding: Finding): void {
    console.log(
        `${finding.classification} ${finding.file}:${finding.line} ${finding.shape}; assertions-after=${finding.assertionsAfter}; ${finding.evidence}`,
    )
}

function controlledBadFixture(): string {
    return [
        "const failures: string[] = []",
        "function check(_name: string, _condition: boolean) {}",
        "check('before', true)",
        "process.exitCode = failures.length === 0 ? 0 : 1",
        "check('late assertion', false)",
    ].join("\n")
}

function runSelfTest(): boolean {
    const findings = analyze("controlled-bad-fixture.ts", controlledBadFixture())
    const defect = findings.find((finding) => finding.classification === "REAL_DEFECT")
    if (!defect || defect.assertionsAfter !== 1) {
        console.error("FAIL self-test: the controlled frozen-verdict fixture was not rejected")
        return false
    }
    console.log(`PASS self-test: controlled frozen-verdict fixture rejected at line ${defect.line} with ${defect.assertionsAfter} assertion after the decision`)
    return true
}

const files = readdirSync(__dirname)
    .filter((file) => /^check-.*\.ts$/u.test(file) && file !== SELF_NAME)
    .sort()
const baseFindings = files.flatMap((file) => analyze(file, readFileSync(join(__dirname, file), "utf8")))
const proveFailure = process.argv.includes("--prove-failure")
const findings = proveFailure
    ? [...baseFindings, ...analyze("controlled-bad-fixture.ts", controlledBadFixture())]
    : baseFindings
const defects = findings.filter((finding) => finding.classification === "REAL_DEFECT")
const guards = findings.filter((finding) => finding.classification === "INTENTIONAL_GUARD")
const preliminary = findings.filter((finding) => finding.classification === "PRELIMINARY_SUMMARY_RECOMPUTED")

for (const finding of findings.filter((finding) => finding.classification !== "FINAL_VERDICT")) printFinding(finding)
console.log(`Scanned ${files.length} check harnesses, excluding ${SELF_NAME}.`)
console.log(`Candidates: ${findings.length}; intentional guards: ${guards.length}; recomputed summaries: ${preliminary.length}; real defects: ${defects.length}.`)

const selfTestOk = process.argv.includes("--self-test") ? runSelfTest() : true
if (defects.length > 0 || !selfTestOk) process.exitCode = 1
