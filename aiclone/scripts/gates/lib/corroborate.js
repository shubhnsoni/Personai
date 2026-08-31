"use strict";

/**
 * corroborate.js — SOURCE-SIDE corroboration of a harness's runtime assertion count.
 *
 * WHY THIS EXISTS
 * ---------------
 * The assertion-evidence contract in run-gates.js reads a NUMBER out of a harness's output. That
 * closed a real hole — a harness that asserts nothing no longer looks identical to one that proves
 * sixty invariants — but it left the number itself unaudited, and two measurements showed how far
 * that goes:
 *
 *   1. An adversarial audit wrote three harnesses with NO imports, NO comparisons and NO subject
 *      under test. They printed well-formed evidence lines and obtained `verdict PASS; gate
 *      ESTABLISHED` with 104153 assertions counted, exit 0. The largest fabricated number arrived
 *      through GATE-EVIDENCE, the form documented as strongest, because identity-bearing evidence is
 *      still self-reported.
 *
 *   2. Sharper, because it came from real code: neutering the assertion helper inside
 *      check-vertical-pack-candidates.ts collapsed its reported count from 447 to 14 and IT STILL
 *      EXITED 0. The count stayed HONEST. Nothing noticed that 433 assertions had stopped running.
 *
 * So the evidence contract measures a harness's willingness to print a number. This module adds the
 * second, INDEPENDENTLY DERIVED signal: the harness's own source must contain executable assertion
 * callsites. Runtime evidence stays REQUIRED — corroboration is an ADDITIONAL condition, never a
 * replacement — and the two signals come from different places, so agreeing to lie in both is a
 * materially harder act than editing a console.log.
 *
 * WHY A REAL PARSER AND NOT A REGEX
 * ---------------------------------
 * The thing being detected is "does this file EXECUTE any assertion". A regex over source text
 * cannot answer that, because it cannot tell code from text ABOUT code:
 *
 *     // assert(1 === 2)                      <- a comment. Not executed.
 *     const doc = "check('x', false)"         <- a string literal. Not executed.
 *     console.log("58/58 assertions passed")  <- output formatting. Not an assertion.
 *
 * All three match a naive /\bassert\s*\(|\bcheck\s*\(/ and none of them can ever fail. A file made
 * only of those would score positive under a regex and would sail through a control built on one —
 * which is the same theatre one layer down. `ts.createSourceFile` produces NO nodes for comments at
 * all, and the contents of a string literal are a single StringLiteral node that is never a
 * CallExpression, so the AST answers the question by construction rather than by pattern luck.
 * fixtures/selftest/corroboration/prose/check-prose.js is that file, and it is asserted to score 0.
 *
 * The repository already depends on the TypeScript compiler API and already uses it for exactly this
 * class of question in scripts/one-off/check-harness-exit-integrity.ts and check-assertion-vacuity.ts.
 * The helper-discovery design below (direct recorders, then forwarding wrappers to a fixed point,
 * then aliases) is deliberately the same shape as the one in check-assertion-vacuity.ts, so a reader
 * of one can read the other. `ts.createSourceFile` parses .js as well as .ts, which matters because
 * the production harnesses are .ts and the self-test fixtures are .js.
 *
 * WHAT IT DOES NOT CLAIM
 * ----------------------
 *  - It does NOT require the runtime count to equal the static callsite count. One callsite inside a
 *    loop legitimately executes forty times; a callsite on a branch not taken executes zero times.
 *    Equality is not a property of correct code, so demanding it would make honest harnesses red and
 *    would be repaired by weakening the check. Only the ZERO-versus-POSITIVE contradiction is sound:
 *    a harness cannot execute N>0 assertions with no assertion callsite in its source.
 *  - It does NOT decide whether an assertion CAN fail. `check("x", true)` is one executable callsite
 *    and this module counts it as one. Falsifiability is check-assertion-vacuity.ts's question, and
 *    duplicating it here badly would be worse than pointing at it.
 *  - It does NOT follow a helper reached through a VALUE. That is refused out loud rather than
 *    guessed at — see CORROBORATION_HELPER_ESCAPES_AS_VALUE. Silent under-counting is the dangerous
 *    direction: it reports an unscanned harness as clean.
 */

const fs = require("node:fs");
const path = require("node:path");

// The compiler API. Resolved from the app's own node_modules like every other dependency here.
const ts = require("typescript");

/** Schema tag for the corroboration block added to the driver's summary. */
const CORROBORATION_SCHEMA = "personai.gates.corroboration/1";

/**
 * Every rejection reason, so the set is enumerable from the code and from the summary — the same
 * discipline EVIDENCE_FINDING_KINDS follows in run-gates.js.
 */
const CORROBORATION_FINDING_KINDS = Object.freeze({
  CORROBORATION_NO_EXECUTABLE_ASSERTIONS:
    "the harness reported a positive runtime assertion count while its source contains no executable assertion callsite, so the number is unsupported by the code that produced it",
  CORROBORATION_SOURCE_UNREADABLE:
    "the harness's source file could not be read, so its runtime count cannot be corroborated at all",
  CORROBORATION_SOURCE_UNPARSEABLE:
    "the parser reported syntax errors in the harness source, so the callsite count would be derived from a partial tree and is refused rather than guessed",
  CORROBORATION_HELPER_ESCAPES_AS_VALUE:
    "an assertion helper is used as a value (passed, stored, or returned) so calls made through that value cannot be seen; the harness is refused explicitly rather than reported clean on an undercount",
});

/**
 * Parameter names this repository uses for "the thing that must be true". Used only to PREFER one
 * parameter when several are used in boolean position; discovery does not depend on it, so a helper
 * with an unusual parameter name is still found.
 */
const CONDITION_PARAMETER_NAMES = new Set([
  "condition", "cond", "pass", "passed", "ok", "okay", "holds", "observed", "expectation", "truth", "assertion", "predicate",
]);

/**
 * Targets whose mutation records a verdict. A function that writes one of these on the strength of a
 * boolean parameter is assertion machinery whatever it is called.
 *
 * Deliberately broad, and safe to be broad: it is only ever consulted together with "this function
 * has a parameter used in boolean position", and it can only ever make the static signal LARGER. The
 * precision that carries weight runs the other way — a file with no assertion machinery must score
 * zero — and no vocabulary can inflate a file that declares no such function and calls nothing.
 */
const VERDICT_TARGET =
  /(?:fail|pass|assert|invariant|check|verdict|defect|problem|error|violation|result|coverage|count|total|exitcode|ok\b)/iu;

/** Member calls that RECORD a value somewhere it will later be judged. */
const RECORDING_METHODS = new Set(["push", "add", "set", "unshift", "append"]);

/** Every operator that WRITES to its left operand: `failures += 1` must count, not only `x = y`. */
const ASSIGNMENT_OPERATORS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

/**
 * Node-builtin assertion modules. A binding imported from one of these is assertion machinery
 * without any local declaration to inspect.
 */
const ASSERT_MODULES = new Set(["assert", "node:assert", "assert/strict", "node:assert/strict"]);

/** Runaway guard on wrapper-discovery rounds. The real terminator is the fixed point. */
const MAX_WRAPPER_ROUNDS = 16;

// ---------------------------------------------------------------------------
// AST plumbing
// ---------------------------------------------------------------------------

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function unwrap(node) {
  let current = node;
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isTypeAssertionExpression && ts.isTypeAssertionExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function lineOf(source, node) {
  try {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  } catch {
    return 0;
  }
}

function textOf(source, node) {
  try {
    return node.getText(source);
  } catch {
    return "";
  }
}

/** The dotted name of a call's callee when it is statically knowable, else null. */
function calleeName(call) {
  const callee = unwrap(call.expression);
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) {
    const root = unwrap(callee.expression);
    if (ts.isIdentifier(root)) return `${root.text}.${callee.name.text}`;
    return null;
  }
  return null;
}

/** The leftmost identifier of a call's callee (`assert.ok(x)` -> "assert"), else null. */
function calleeRoot(call) {
  let callee = unwrap(call.expression);
  while (ts.isPropertyAccessExpression(callee)) callee = unwrap(callee.expression);
  return ts.isIdentifier(callee) ? callee.text : null;
}

/** Normalise the function-like declarations that can carry a name we could call. */
function asNamedFunction(node) {
  if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return { name: node.name.text, parameters: node.parameters, body: node.body, node };
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    const initializer = unwrap(node.initializer);
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
      return { name: node.name.text, parameters: initializer.parameters, body: initializer.body, node };
    }
  }
  return null;
}

function isProcessExitNonZero(node) {
  if (!ts.isCallExpression(node)) return false;
  if (calleeName(node) !== "process.exit") return false;
  const first = node.arguments[0];
  if (!first) return false;
  const arg = unwrap(first);
  if (ts.isNumericLiteral(arg)) return Number(arg.text) !== 0;
  // A non-literal exit code cannot be shown to be zero, so treat it as a real failure path.
  return true;
}

/**
 * Does this body RECORD a verdict — throw, exit non-zero, write to a verdict-shaped target, or push
 * onto one? This is what separates assertion machinery from a function that merely takes a flag.
 */
function recordsVerdict(source, body) {
  if (!body) return null;
  let how = null;
  walk(body, (node) => {
    if (how) return;
    if (ts.isThrowStatement(node)) {
      how = "throws";
      return;
    }
    if (isProcessExitNonZero(node)) {
      how = "exits non-zero";
      return;
    }
    if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) {
      if (VERDICT_TARGET.test(textOf(source, node.left))) how = `writes ${textOf(source, node.left).slice(0, 40)}`;
      return;
    }
    if (
      (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
      VERDICT_TARGET.test(textOf(source, node.operand))
    ) {
      how = `increments ${textOf(source, node.operand).slice(0, 40)}`;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (
        ts.isPropertyAccessExpression(callee) &&
        RECORDING_METHODS.has(callee.name.text) &&
        VERDICT_TARGET.test(textOf(source, callee.expression))
      ) {
        how = `records into ${textOf(source, callee.expression).slice(0, 40)}`;
      }
    }
  });
  return how;
}

/**
 * Is the parameter named `parameterName` RECORDED by this body — does it reach the arguments of a
 * `push`/`add`/`set` style call, or the right-hand side of an assignment?
 *
 * THIS TIER IS NOT OPTIONAL, AND MEASUREMENT IS WHY. The dominant assertion helper in this
 * repository does not test its condition at all:
 *
 *     const results: Array<{ name: string; pass: boolean; detail: string }> = []
 *     function check(name: string, pass: boolean, detail = "") { results.push({ name, pass, detail }) }
 *
 * The verdict is computed later, from `results`. `pass` never appears in boolean position, so the
 * boolean-position rule alone does not see this function — and it is the helper in TWENTY-ONE of the
 * 76 harnesses. Before this tier existed those files scored on inline `if (...) throw` guards only:
 * check-appointment-authz.ts scored 3 against a real 43 assertions. Non-zero, so the gate still held,
 * but a 40-assertion undercount is exactly the direction that reports an unscanned harness as clean,
 * and one refactor away from scoring zero and failing an honest harness.
 *
 * The rule is deliberately narrower than "the parameter is used": a boolean parameter merely TESTED
 * for a side effect (`function log(msg, verbose) { if (verbose) console.log(msg) }`) is not recorded
 * anywhere and is correctly not an assertion helper. Being written down for later judgement is what
 * makes it one.
 */
function recordsParameter(source, body, parameterName) {
  let recorded = null;
  const mentions = (node) => {
    let found = false;
    walk(node, (inner) => {
      if (found) return;
      if (ts.isIdentifier(inner) && inner.text === parameterName) found = true;
    });
    return found;
  };
  walk(body, (node) => {
    if (recorded) return;
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (!ts.isPropertyAccessExpression(callee)) return;
      if (!RECORDING_METHODS.has(callee.name.text)) return;
      if (node.arguments.some((argument) => mentions(argument))) {
        recorded = `recorded into ${textOf(source, callee.expression).slice(0, 40)}.${callee.name.text}(...)`;
      }
      return;
    }
    if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind) && mentions(node.right)) {
      recorded = `assigned into ${textOf(source, node.left).slice(0, 40)}`;
    }
  });
  return recorded;
}

/** Is this parameter annotated `boolean` (TypeScript only; .js files have no annotation)? */
function isBooleanTyped(parameter) {
  const type = parameter.type;
  if (!type) return false;
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return true;
  // `pass: boolean | undefined` and `pass?: boolean` still carry a boolean member.
  if (ts.isUnionTypeNode(type)) return type.types.some((member) => member.kind === ts.SyntaxKind.BooleanKeyword);
  return false;
}

/**
 * Is this expression a compile-time constant — a literal, a negated literal, or a comparison between
 * two literals?
 *
 * WHY THIS EXCLUSION EXISTS. It closes the cheapest way to defeat this layer. Corroboration asks "is
 * there executable assertion machinery here", and a print-only liar could satisfy a naive version of
 * that by adding one line of machinery that cannot fail:
 *
 *     if (1 === 1) passed += 1                 // records a verdict, tests nothing
 *     assert("precondition", true)             // a callsite whose condition is a literal
 *
 * Both are constant at parse time, so neither is evidence that the harness computed anything, and
 * both are refused. This is deliberately shallow: it folds literals and literal-to-literal
 * comparisons and stops. Deciding whether a NON-constant condition can ever be false is a different
 * and much harder question, and this repository already answers it in
 * scripts/one-off/check-assertion-vacuity.ts (VACUOUS_LITERAL, VACUOUS_TAUTOLOGY,
 * VACUOUS_SELF_COMPARISON, VACUOUS_DERIVED_EXPECTATION). Re-implementing that here, worse, would be
 * the opposite of useful. The honest statement of the boundary: this layer proves a harness executes
 * assertion machinery over values it did not know at parse time; whether that machinery CAN fail is
 * the vacuity scanner's question, and the two controls are complementary.
 */
function isConstantExpression(node) {
  const expression = unwrap(node);
  if (
    ts.isNumericLiteral(expression) ||
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isRegularExpressionLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (ts.isIdentifier(expression) && expression.text === "undefined") return true;
  if (
    ts.isPrefixUnaryExpression(expression) &&
    (expression.operator === ts.SyntaxKind.ExclamationToken || expression.operator === ts.SyntaxKind.MinusToken)
  ) {
    return isConstantExpression(expression.operand);
  }
  if (ts.isBinaryExpression(expression)) {
    return isConstantExpression(expression.left) && isConstantExpression(expression.right);
  }
  return false;
}

/**
 * Mark the names in `expression` that sit in BOOLEAN POSITION, recursing only through the operators
 * that preserve that position.
 *
 * The soundness rule, taken from check-assertion-vacuity.ts: a name counts when it is the whole
 * expression, under `!`, an operand of `&&`/`||`/`??`, or a branch or test of `?:`. A name appearing
 * as an operand of `===`, or as a property or call receiver, does NOT count — that is a value being
 * inspected, not a verdict being forwarded, and admitting it would classify condition-BUILDING
 * wrappers as forwarders and count their string and fixture arguments as conditions.
 */
function markBooleanPosition(expression, candidates, found) {
  const node = unwrap(expression);
  if (ts.isIdentifier(node)) {
    if (candidates.has(node.text)) found.add(node.text);
    return;
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    markBooleanPosition(node.operand, candidates, found);
    return;
  }
  if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
    markBooleanPosition(node.left, candidates, found);
    markBooleanPosition(node.right, candidates, found);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    markBooleanPosition(node.condition, candidates, found);
    markBooleanPosition(node.whenTrue, candidates, found);
    markBooleanPosition(node.whenFalse, candidates, found);
  }
}

/**
 * Which of `candidates` are in boolean position ANYWHERE inside `root` — used to decide whether a
 * function TESTS one of its parameters.
 */
function booleanPositionNames(root, candidates) {
  const found = new Set();
  if (candidates.size === 0) return found;

  walk(root, (node) => {
    if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      markBooleanPosition(node.expression, candidates, found);
    } else if (ts.isConditionalExpression(node)) {
      markBooleanPosition(node.condition, candidates, found);
    } else if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      markBooleanPosition(node.operand, candidates, found);
    } else if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
      markBooleanPosition(node.left, candidates, found);
      markBooleanPosition(node.right, candidates, found);
    }
  });
  return found;
}

/**
 * Which of `candidates` a known helper's CONDITION ARGUMENT forwards.
 *
 * Distinct from booleanPositionNames on purpose, and the distinction was a real bug: an argument that
 * IS the bare parameter (`record(name, holds, detail)`) contains no `if`, no `!` and no `&&`, so a
 * walk looking for those constructs found nothing and the wrapper went unregistered. The argument in
 * a condition slot is BY DEFINITION in boolean position, so it is marked directly. Measured effect of
 * getting this wrong: check-ratio.js's six assertions through `expect`/`expectEqual` counted as one.
 */
function conditionForwardedNames(conditionExpression, candidates) {
  const found = new Set();
  if (candidates.size === 0) return found;
  markBooleanPosition(conditionExpression, candidates, found);
  return found;
}

/** Parameter names, by index, for the parameters that are plain identifiers. */
function parameterIndex(parameters) {
  const byName = new Map();
  parameters.forEach((parameter, index) => {
    if (ts.isIdentifier(parameter.name)) byName.set(parameter.name.text, index);
  });
  return byName;
}

/**
 * Pick the parameter that carries the condition: a conventional name if one of the boolean-position
 * parameters has one, otherwise the lowest-indexed boolean-position parameter.
 */
function pickConditionIndex(byName, booleanNames) {
  let best = null;
  for (const name of booleanNames) {
    const index = byName.get(name);
    if (index === undefined) continue;
    const preferred = CONDITION_PARAMETER_NAMES.has(name);
    if (best === null || (preferred && !best.preferred) || (preferred === best.preferred && index < best.index)) {
      best = { name, index, preferred };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Helper discovery
// ---------------------------------------------------------------------------

/**
 * Find every name that, when called, makes an assertion.
 *
 * TIER 1  direct recorders      a local function with a boolean-position parameter whose body throws,
 *                               exits non-zero, or writes a verdict-shaped target.
 * TIER 2  forwarding wrappers   a local function that hands one of its parameters to a known helper's
 *                               condition slot in boolean position. Iterated to a FIXED POINT, because
 *                               a wrapper three links above a real helper is still a helper and a
 *                               fixed bound would silently leave it unscanned.
 * TIER 3  aliases               `const ok = check`, resolved transitively.
 * TIER 4  builtin assert        a binding imported or required from node:assert.
 */
function discoverHelpers(source) {
  const helpers = new Map(); // name -> { conditionIndex, kind, via, bodyPos, bodyEnd }
  const notes = [];

  // ---- tier 4 first: an imported assert has no body to inspect ------------------------------
  walk(source, (node) => {
    // import assert from "node:assert"  /  import { strict as assert } from "node:assert"
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!ASSERT_MODULES.has(node.moduleSpecifier.text)) return;
      const clause = node.importClause;
      if (!clause) return;
      if (clause.name && ts.isIdentifier(clause.name)) {
        helpers.set(clause.name.text, { conditionIndex: 0, kind: "node-assert", via: `import from ${node.moduleSpecifier.text}` });
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          helpers.set(element.name.text, { conditionIndex: 0, kind: "node-assert", via: `import from ${node.moduleSpecifier.text}` });
        }
      }
      return;
    }
    // const assert = require("node:assert")
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (!ts.isCallExpression(initializer)) return;
      if (calleeName(initializer) !== "require") return;
      const specifier = initializer.arguments[0] ? unwrap(initializer.arguments[0]) : null;
      if (!specifier || !ts.isStringLiteral(specifier) || !ASSERT_MODULES.has(specifier.text)) return;
      helpers.set(node.name.text, { conditionIndex: 0, kind: "node-assert", via: `require("${specifier.text}")` });
    }
  });

  // ---- tier 1a: direct recorders that TEST their condition -----------------------------------
  walk(source, (node) => {
    const candidate = asNamedFunction(node);
    if (!candidate || !candidate.body) return;
    const byName = parameterIndex(candidate.parameters);
    if (byName.size === 0) return;
    const booleanNames = booleanPositionNames(candidate.body, new Set(byName.keys()));
    if (booleanNames.size === 0) return;
    const how = recordsVerdict(source, candidate.body);
    if (!how) return;
    const picked = pickConditionIndex(byName, booleanNames);
    if (!picked) return;
    if (helpers.has(candidate.name) && helpers.get(candidate.name).kind === "node-assert") return;
    helpers.set(candidate.name, {
      conditionIndex: picked.index,
      kind: "recorder",
      via: `parameter \`${picked.name}\` in boolean position; body ${how}`,
      bodyPos: candidate.body.pos,
      bodyEnd: candidate.body.end,
    });
  });

  // ---- tier 1b: COLLECTORS that write their condition down for later judgement ----------------
  //
  // See recordsParameter: this is the shape 21 of the 76 harnesses actually use, and it tests
  // nothing at the point of call. Requiring a boolean ANNOTATION or a conventional parameter name
  // keeps it from swallowing arbitrary two-argument functions, and requiring the parameter to be
  // RECORDED keeps it from swallowing booleans that merely gate a side effect.
  walk(source, (node) => {
    const candidate = asNamedFunction(node);
    if (!candidate || !candidate.body || helpers.has(candidate.name)) return;
    let chosen = null;
    candidate.parameters.forEach((parameter, index) => {
      if (chosen) return;
      if (!ts.isIdentifier(parameter.name)) return;
      const name = parameter.name.text;
      const typed = isBooleanTyped(parameter);
      const conventional = CONDITION_PARAMETER_NAMES.has(name);
      if (!typed && !conventional) return;
      const recorded = recordsParameter(source, candidate.body, name);
      if (!recorded) return;
      chosen = { index, name, why: `${typed ? "boolean-annotated" : "conventionally named"} parameter \`${name}\` ${recorded}` };
    });
    if (!chosen) return;
    helpers.set(candidate.name, {
      conditionIndex: chosen.index,
      kind: "collector",
      via: chosen.why,
      bodyPos: candidate.body.pos,
      bodyEnd: candidate.body.end,
    });
  });

  // ---- tier 2: condition-forwarding wrappers, to a fixed point -------------------------------
  let rounds = 0;
  let converged = false;
  while (rounds < MAX_WRAPPER_ROUNDS) {
    rounds += 1;
    let grew = false;
    walk(source, (node) => {
      const candidate = asNamedFunction(node);
      if (!candidate || !candidate.body || helpers.has(candidate.name)) return;
      const byName = parameterIndex(candidate.parameters);
      if (byName.size === 0) return;

      let registered = null;
      walk(candidate.body, (inner) => {
        if (registered !== null) return;
        if (!ts.isCallExpression(inner)) return;
        const name = calleeName(inner);
        if (!name) return;
        const helper = helpers.get(name);
        if (!helper) return;
        const condition = inner.arguments[helper.conditionIndex];
        if (!condition) return;
        const forwarded = conditionForwardedNames(condition, new Set(byName.keys()));
        // Exactly one parameter may reach the condition slot; two means the wrapper BUILDS a
        // condition out of several inputs, and guessing which one is "the" verdict would be
        // reasoning about the wrong value.
        if (forwarded.size !== 1) return;
        const forwardedName = [...forwarded][0];
        registered = {
          conditionIndex: byName.get(forwardedName),
          via: `${name}(arg${helper.conditionIndex} carries parameter \`${forwardedName}\`) — round ${rounds}`,
        };
      });
      if (!registered) return;
      helpers.set(candidate.name, {
        conditionIndex: registered.conditionIndex,
        kind: "wrapper",
        via: registered.via,
        bodyPos: candidate.body.pos,
        bodyEnd: candidate.body.end,
      });
      grew = true;
    });
    if (!grew) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    notes.push(
      `wrapper discovery hit its ${MAX_WRAPPER_ROUNDS}-round runaway guard without reaching a fixed point; ` +
        "the helper set may be incomplete",
    );
  }

  // ---- tier 3: identifier aliases, transitively ----------------------------------------------
  for (let round = 0; round < MAX_WRAPPER_ROUNDS; round += 1) {
    let grew = false;
    walk(source, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
      const initializer = unwrap(node.initializer);
      if (!ts.isIdentifier(initializer)) return;
      const target = helpers.get(initializer.text);
      if (!target || helpers.has(node.name.text)) return;
      helpers.set(node.name.text, {
        conditionIndex: target.conditionIndex,
        kind: "alias",
        via: `alias of ${initializer.text}`,
      });
      grew = true;
    });
    if (!grew) break;
  }

  return { helpers, notes, wrapperRounds: rounds, converged };
}

// ---------------------------------------------------------------------------
// Callsite counting and the explicit refusals
// ---------------------------------------------------------------------------

/**
 * Is `position` inside one of the discovered helpers' own bodies? A wrapper calling `check` is
 * plumbing, not a callsite, and counting both would inflate the signal with the machinery itself.
 */
function insideHelperBody(helpers, position) {
  for (const helper of helpers.values()) {
    if (helper.bodyPos === undefined) continue;
    if (position >= helper.bodyPos && position < helper.bodyEnd) return true;
  }
  return false;
}

/**
 * A CONDITIONAL THAT RECORDS A VERDICT is an inline assertion.
 *
 * Two shapes, both real and both common in this tree:
 *
 *     if (!response.ok) throw new Error("...")            <- fails loudly on the spot
 *     if (process.env.DATABASE_URL === undefined) passed += 1
 *     else { failed += 1; console.log("FAIL ...") }       <- records, and the exit code is computed later
 *
 * Requiring a throw would miss the second entirely: fixtures/audit-nodb/check-nodb.js is written that
 * way and asserts two real things, so a throw-only rule scored it ZERO and would have failed an
 * honest harness. Either branch may carry the verdict, because `if (ok) passed++ else failed++` puts
 * it in both.
 *
 * A conditional is NOT counted merely for existing: the branch must throw, exit non-zero, set
 * process.exitCode, or write/record a verdict-shaped target. `if (verbose) console.log(x)` is not an
 * assertion and is not counted.
 */
function inlineGuardReason(source, node) {
  if (!ts.isIfStatement(node)) return null;
  // A conditional whose test is constant at parse time proves nothing was computed. See
  // isConstantExpression for why this is deliberately shallow.
  if (isConstantExpression(node.expression)) return null;
  const branches = [node.thenStatement, node.elseStatement].filter(Boolean);
  if (branches.length === 0) return null;
  for (const branch of branches) {
    // An `else if` chain is its own IfStatement and is visited separately; crediting the outer one
    // for the inner one's verdict would count the same conditional twice.
    if (ts.isIfStatement(branch)) continue;
    const how = recordsVerdict(source, branch);
    if (how) return how;
  }
  return null;
}

/**
 * Analyse ONE harness source. Pure: reads nothing but the text it is handed.
 *
 * Returns { signal, callsites, inlineGuards, helpers, refusals, ... }. `signal` is the number this
 * module contributes to the contract, and only its zero-versus-positive distinction is used.
 */
function analyzeSource(fileLabel, text) {
  const source = ts.createSourceFile(fileLabel, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);

  // Syntax errors mean the tree is partial, so a count taken from it would be an undercount of
  // unknown size. Refuse rather than guess. `parseDiagnostics` is not in the public typings but is
  // the only place createSourceFile records syntactic problems, so it is read defensively.
  const diagnostics = Array.isArray(source.parseDiagnostics) ? source.parseDiagnostics : [];
  if (diagnostics.length > 0) {
    const first = diagnostics[0];
    return {
      file: fileLabel,
      parsed: false,
      signal: 0,
      callsites: 0,
      inlineGuards: 0,
      helpers: [],
      helperCallsites: 0,
      refusals: [
        {
          kind: "CORROBORATION_SOURCE_UNPARSEABLE",
          detail:
            `${fileLabel} produced ${diagnostics.length} syntax diagnostic(s) when parsed; the first is ` +
            `${JSON.stringify(String(ts.flattenDiagnosticMessageText(first.messageText, " ")).slice(0, 200))}. ` +
            "A callsite count taken from a partial tree would be an undercount of unknown size, so it is refused.",
        },
      ],
      notes: [],
    };
  }

  const { helpers, notes, wrapperRounds, converged } = discoverHelpers(source);
  const helperNames = new Set(helpers.keys());

  let helperCallsites = 0;
  let inlineGuards = 0;
  let constantCallsites = 0;
  const callsiteLines = [];
  const escapes = new Map(); // helper name -> [{ line, context }]
  const indirect = [];

  walk(source, (node) => {
    // ---- assertion callsites ---------------------------------------------------------------
    if (ts.isCallExpression(node)) {
      const position = node.getStart(source);
      const dotted = calleeName(node);
      const root = calleeRoot(node);
      const hit = (dotted && helperNames.has(dotted)) || (root && helperNames.has(root));
      if (hit && !insideHelperBody(helpers, position)) {
        // A callsite whose condition argument is a parse-time constant - `assert("x", true)` - is
        // machinery running over nothing, so it is not counted. When the helper's condition slot is
        // unknown (a builtin assert, or an alias whose index was inherited) the argument at that
        // index is still the right one to test.
        const helper = helpers.get(dotted && helperNames.has(dotted) ? dotted : root);
        const conditionArgument = helper ? node.arguments[helper.conditionIndex] : undefined;
        const constant = conditionArgument !== undefined && isConstantExpression(conditionArgument);
        if (constant) {
          constantCallsites += 1;
        } else {
          helperCallsites += 1;
          if (callsiteLines.length < 20) callsiteLines.push({ line: lineOf(source, node), callee: dotted || root });
        }
      }
      // ---- refusal: a call through something we cannot name --------------------------------
      const callee = unwrap(node.expression);
      if (
        helperNames.size > 0 &&
        (ts.isElementAccessExpression(callee) ||
          (ts.isPropertyAccessExpression(callee) && !ts.isIdentifier(unwrap(callee.expression))))
      ) {
        // Only interesting when the receiver could be carrying a helper; the escape check below is
        // what proves that, so this is recorded and reported together with it.
        indirect.push({ line: lineOf(source, node), text: textOf(source, node).slice(0, 80) });
      }
      return;
    }

    // ---- inline guards ----------------------------------------------------------------------
    const guard = inlineGuardReason(source, node);
    if (guard) {
      const position = node.getStart(source);
      if (!insideHelperBody(helpers, position)) {
        inlineGuards += 1;
        if (callsiteLines.length < 20) callsiteLines.push({ line: lineOf(source, node), callee: `if(...) ${guard}` });
      }
      return;
    }

    // ---- refusal: a helper used as a VALUE --------------------------------------------------
    //
    // `register(check)`, `const table = { check }`, `return check` all make calls possible through a
    // route this module cannot see. Under-counting there would report an unscanned harness as clean,
    // so it is named and failed instead of absorbed.
    if (!ts.isIdentifier(node)) return;
    if (!helperNames.has(node.text)) return;
    const parent = node.parent;
    if (!parent) return;
    // Not an escape: being the callee, being declared, being the alias target, or being a property key.
    if (ts.isCallExpression(parent) && unwrap(parent.expression) === node) return;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return;
    if (ts.isFunctionDeclaration(parent) && parent.name === node) return;
    if (ts.isVariableDeclaration(parent) && parent.name === node) return;
    if (ts.isParameter(parent) && parent.name === node) return;
    if (ts.isVariableDeclaration(parent) && parent.initializer && unwrap(parent.initializer) === node) return;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return;
    if (
      ts.isPropertyAccessExpression(parent) ||
      ts.isTypeReferenceNode?.(parent) ||
      ts.isBindingElement(parent)
    ) {
      return;
    }
    const escapeKind = ts.isCallExpression(parent)
      ? "passed as an argument"
      : ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent)
        ? "stored in an object literal"
        : ts.isArrayLiteralExpression(parent)
          ? "stored in an array literal"
          : ts.isReturnStatement(parent)
            ? "returned"
            : ts.isBinaryExpression(parent) && ASSIGNMENT_OPERATORS.has(parent.operatorToken.kind)
              ? "assigned to another binding"
              : "used as a value";
    if (!escapes.has(node.text)) escapes.set(node.text, []);
    escapes.get(node.text).push({ line: lineOf(source, node), how: escapeKind });
  });

  const refusals = [];
  for (const [name, sites] of escapes) {
    const where = sites.slice(0, 4).map((s) => `line ${s.line} (${s.how})`).join(", ");
    refusals.push({
      kind: "CORROBORATION_HELPER_ESCAPES_AS_VALUE",
      detail:
        `the assertion helper \`${name}\` is used as a value at ${where}. Calls made through that value are ` +
        "invisible to a source scan, so the callsite count would be an undercount of unknown size. Reporting " +
        "the harness as corroborated on an undercount is the dangerous direction — it presents an unscanned " +
        "harness as clean — so this is refused explicitly instead." +
        (indirect.length > 0
          ? ` ${indirect.length} call(s) through a computed or nested callee were also seen, e.g. line ${indirect[0].line}.`
          : ""),
    });
  }

  return {
    file: fileLabel,
    parsed: true,
    signal: helperCallsites + inlineGuards,
    callsites: helperCallsites + inlineGuards,
    helperCallsites,
    inlineGuards,
    // Callsites and guards that were seen but NOT counted because their condition is constant at
    // parse time. Reported rather than dropped, so an undercount is visible to a reader.
    constantCallsites,
    helpers: [...helpers.entries()].map(([name, h]) => ({
      name,
      kind: h.kind,
      conditionIndex: h.conditionIndex,
      via: h.via,
    })),
    sampleCallsites: callsiteLines,
    refusals,
    notes,
    wrapperRounds,
    wrapperFixedPoint: converged,
  };
}

/** Read and analyse a harness on disk. Missing or unreadable files become a named refusal. */
function analyzeFile(absPath, label) {
  const fileLabel = label || path.basename(absPath);
  let text;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch (error) {
    return {
      file: fileLabel,
      parsed: false,
      signal: 0,
      callsites: 0,
      helperCallsites: 0,
      inlineGuards: 0,
      helpers: [],
      sampleCallsites: [],
      refusals: [
        {
          kind: "CORROBORATION_SOURCE_UNREADABLE",
          detail:
            `${fileLabel} could not be read (${error.code || error.message}), so a runtime assertion count from ` +
            "it cannot be corroborated against anything. An uncorroborated count is exactly what this layer exists " +
            "to refuse.",
        },
      ],
      notes: [],
    };
  }
  return analyzeSource(fileLabel, text);
}

/**
 * THE CONTRACT, over one run.
 *
 * For each harness the driver counted as passed WITH a positive runtime assertion count, require a
 * non-zero, independently derived static signal from EXECUTABLE source. Two properties are load
 * bearing and both are deliberate:
 *
 *  - Runtime evidence stays REQUIRED. This function judges only harnesses that already produced a
 *    positive count, so it can never be the reason an unevidenced harness passes.
 *  - Only the ZERO-versus-POSITIVE contradiction is enforced. `runtime === static` is false for all
 *    correct code that loops or branches, so it is not asserted; see the module header.
 *
 * @param {object}   args
 * @param {Array}    args.evidenceRecords  validated evidence records (harness + assertions)
 * @param {string}   args.harnessDirAbs    absolute directory the harness files live in
 * @param {Set}      args.allowlisted      harness filenames exempt from the evidence contract
 * @param {boolean}  args.enabled          false only under a self-test fault, which voids the run
 * @returns {{ findings: Array, block: object }}
 */
function evaluateCorroboration({ evidenceRecords, harnessDirAbs, allowlisted, enabled }) {
  const findings = [];
  const records = [];

  if (enabled) {
    for (const evidence of evidenceRecords) {
      if (!evidence || evidence.assertions <= 0) continue;
      if (allowlisted && allowlisted.has(evidence.harness)) continue;

      const analysis = analyzeFile(path.join(harnessDirAbs, evidence.harness), evidence.harness);

      // An explicit refusal is a failure in its own right: it says the scan could not see the whole
      // picture, and a partial scan reported as clean is worse than a declared gap.
      for (const refusal of analysis.refusals) {
        findings.push({ kind: refusal.kind, harness: evidence.harness, detail: refusal.detail });
      }

      if (analysis.parsed && analysis.refusals.length === 0 && analysis.signal === 0) {
        findings.push({
          kind: "CORROBORATION_NO_EXECUTABLE_ASSERTIONS",
          harness: evidence.harness,
          detail:
            `${evidence.harness} reported ${evidence.assertions} assertion(s) at runtime (${evidence.form}) while its ` +
            "source contains no executable assertion callsite: no call to a local assertion helper, no builtin " +
            "assert, and no `if (...) throw` guard. Comments, string literals and console output are not " +
            "callsites — the source is parsed with the TypeScript compiler API precisely so that text ABOUT " +
            "assertions cannot be mistaken for assertions. A number a harness prints is not evidence that the " +
            "harness computed anything, so the count is not accepted.",
        });
      }

      records.push({
        harness: evidence.harness,
        runtimeAssertions: evidence.assertions,
        staticSignal: analysis.signal,
        helperCallsites: analysis.helperCallsites,
        inlineGuards: analysis.inlineGuards,
        parsed: analysis.parsed,
        helpers: analysis.helpers.map((h) => `${h.name} (${h.kind})`),
        refused: analysis.refusals.map((r) => r.kind),
        // Recorded, never asserted: a loop runs one callsite many times, so the ratio is information
        // for a reader and not a condition. See the module header.
        ratioNote:
          analysis.signal === 0
            ? "no static signal"
            : `${evidence.assertions} runtime / ${analysis.signal} static callsite(s) — not required to match`,
      });
    }
  }

  return {
    findings,
    block: {
      schema: CORROBORATION_SCHEMA,
      enabled: Boolean(enabled),
      contract:
        "A positive runtime assertion count must be corroborated by a non-zero, independently derived static " +
        "signal from EXECUTABLE source, obtained with the TypeScript compiler API so that comments, string " +
        "literals and output formatting cannot count. Runtime evidence remains required; this is an additional " +
        "condition. The runtime and static counts are NOT required to match, because a loop executes one " +
        "callsite many times — only the zero-versus-positive contradiction is sound.",
      rejectionKinds: CORROBORATION_FINDING_KINDS,
      counts: {
        judged: records.length,
        corroborated: records.filter((r) => r.staticSignal > 0 && r.refused.length === 0).length,
        contradicted: findings.filter((f) => f.kind === "CORROBORATION_NO_EXECUTABLE_ASSERTIONS").length,
        refused: findings.filter((f) => f.kind !== "CORROBORATION_NO_EXECUTABLE_ASSERTIONS").length,
        findings: findings.length,
      },
      records,
    },
  };
}

module.exports = {
  CORROBORATION_SCHEMA,
  CORROBORATION_FINDING_KINDS,
  CONDITION_PARAMETER_NAMES,
  VERDICT_TARGET,
  MAX_WRAPPER_ROUNDS,
  analyzeSource,
  analyzeFile,
  evaluateCorroboration,
  discoverHelpers,
  booleanPositionNames,
  conditionForwardedNames,
};

// ---------------------------------------------------------------------------
// Standalone corpus mode. `node scripts/gates/lib/corroborate.js <file|dir>...`
//
// This exists so the static signal for the WHOLE harness corpus can be measured without running the
// 20-minute sweep: the analysis touches no database and executes no harness. It is how "every
// production harness that genuinely asserts still scores non-zero" is checked as a measurement
// rather than asserted as a belief.
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const targets = [];
  for (const arg of args) {
    let stat;
    try {
      stat = fs.statSync(arg);
    } catch {
      process.stderr.write(`not found: ${arg}\n`);
      process.exit(2);
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(arg).sort()) {
        if (/^check-.*\.(ts|js)$/u.test(name)) targets.push(path.join(arg, name));
      }
    } else {
      targets.push(arg);
    }
  }
  if (targets.length === 0) {
    process.stderr.write("usage: node scripts/gates/lib/corroborate.js <file|dir>...\n");
    process.exit(2);
  }
  let zero = 0;
  let refused = 0;
  for (const target of targets) {
    const analysis = analyzeFile(target, path.basename(target));
    if (analysis.signal === 0) zero += 1;
    if (analysis.refusals.length > 0) refused += 1;
    process.stdout.write(
      `${String(analysis.signal).padStart(5)}  ${path.basename(target).padEnd(46)} ` +
        `helpers=${analysis.helpers.length} calls=${analysis.helperCallsites} guards=${analysis.inlineGuards}` +
        `${analysis.refusals.length ? `  REFUSED ${analysis.refusals.map((r) => r.kind).join(",")}` : ""}` +
        `${analysis.parsed ? "" : "  UNPARSEABLE"}\n`,
    );
  }
  process.stdout.write(`\n${targets.length} file(s); ${zero} scored ZERO; ${refused} refused\n`);
  process.exit(0);
}
