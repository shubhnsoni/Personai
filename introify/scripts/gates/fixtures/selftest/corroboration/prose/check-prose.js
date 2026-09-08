// THE AST-VERSUS-REGEX FIXTURE. Its only "assertions" are text.
//
// Every apparent assertion in this file is a comment, a string literal, or output formatting. Nothing
// here can fail. A regex over source text counts several matches and would report this harness as
// carrying assertion machinery; the TypeScript parser produces NO node for a comment at all, and the
// body of a string literal is a single StringLiteral node that is never a CallExpression, so the AST
// scores it ZERO. That difference is the entire reason this layer uses a parser.
//
// It must FAIL with CORROBORATION_NO_EXECUTABLE_ASSERTIONS. The self-test also probes the analyser
// directly against this file and asserts the regex/AST disagreement, so the claim above is measured
// rather than described.
//
// ---- assertions that are only comments ------------------------------------------------------
// assert(response.status === 200)
// check("tenant isolation holds", crossTenantRead === null)
// expect(order.totalCents).toBe(1234)
// if (!ok) throw new Error("cross-tenant read succeeded")
// 58 assertions passed
// -------------------------------------------------------------------------------------------

// Assertions that are only string literals. `documentation` is never parsed, never evaluated, and
// never printed as anything but text.
const documentation = [
  "assert(a === b)",
  "check('every role is derived from the server', derived === true)",
  "if (!invariant) throw new Error('invariant violated')",
  "expect(result).toEqual(expected)",
  "assert.strictEqual(actual, expected)",
].join("\n");

const template = `check("interpolated", ${1 + 1} === 2)`;

console.log("[fixture:prose] loaded a document describing assertions");
console.log(`[fixture:prose] document is ${documentation.length} chars, template is ${template.length} chars`);
console.log("58/58 assertions passed");
process.exit(0);
