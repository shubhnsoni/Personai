/**
 * THE ONE HTTP METHOD CLASSIFIER for this repository's route modules.
 *
 * WHY THIS FILE EXISTS. Seven separate classifier sites had grown across six harnesses, and they
 * disagreed on three axes at once:
 *
 *   DECLARATION STYLES. Three tiers were in use. `check-operations-routes.ts` and the first site in
 *   `check-blueprint-preview.ts` matched only `export async function VERB(`; `check-blueprint-install-routes.ts`
 *   matched `export async function VERB\b`; the second site in `check-blueprint-preview.ts` and the pair in
 *   `check-operations-runtime.ts` / `check-due-work-preview-api.ts` matched
 *   `export [async] function|const VERB`; `check-onboarding-blueprint-coverage.ts` added `let` and `var`.
 *
 *   SAFE METHODS. Only the runtime/due-work pair modelled HEAD and OPTIONS at all. The other five were
 *   silent about them, so they could not make the safe-method claim either way.
 *
 *   COMMENTS AND STRINGS. Only the runtime/due-work pair stripped comments first. The other five tested
 *   raw source, so a verb name written inside a comment - which is exactly how this repository documents a
 *   prohibition - counted as a declaration. This repository has already mistaken a prohibition for a
 *   violation five times, by its own count.
 *
 * The consequence was measurable and it was not theoretical. Measured over this tree's 154 route modules
 * under `src/app/api` (every file named `route.ts`):
 *
 *   `export async function GET(`                       misses 28 GET-exporting route files
 *                                                      (26 use `export function GET`, 2 use `export const GET`)
 *   `export async function (POST|PATCH|PUT|DELETE)(`   misses 21 route files that DO export a state-changing verb
 *
 * So the narrow sites were policing a no-write guarantee they could not actually see 21 files' worth of.
 *
 * WHY AN AST AND NOT A REGEX. Two reasons, and only the second one is currently load-bearing - which is
 * stated plainly here rather than dressed up:
 *
 *   1. NOT a real-corpus win today. I measured it: ZERO route files in this tree contain a
 *      verb-export token inside a comment or a string. So on today's corpus a correct wide regex and this
 *      AST agree on every single file, and `check-http-method-classifier.ts` asserts that agreement in
 *      both directions over the whole corpus rather than asserting a superiority I did not observe.
 *   2. It STAYS correct. The five raw-source sites are one comment away from a false positive, and the
 *      comment that would do it is the kind this repository writes deliberately: "no POST is exported
 *      here". A `ts.SourceFile` cannot see into a comment or a string literal at all, so that whole class
 *      of defect stops being possible rather than being currently absent. The synthetic corpus in the
 *      harness proves the difference on shapes the real corpus does not yet contain.
 *
 * A regex is additionally unable to distinguish a top-level export from a nested one, and unable to see a
 * re-export (`export { handler as POST }`) at all - a shape no site covered and which is the least
 * effortful way to smuggle a write verb past every one of them. The AST handles both by construction.
 *
 * HEAD AND OPTIONS ARE SAFE METHODS - RFC 9110 section 9.2.1. Neither is a request to change anything, so
 * neither may EVER be classified as state-changing. This file keeps the honest split the repository
 * already adopted in `due-work-http.ts` and its two harnesses:
 *
 *   STATE_CHANGING_METHODS   POST, PUT, PATCH, DELETE. Their ABSENCE from a route module is the no-write
 *                            guarantee, and it is the only claim an export scan may support.
 *   SAFE_METHOD_HANDLERS     HEAD, OPTIONS. Their absence guarantees NOTHING about writes. It is the
 *                            PRECONDITION for next@16.3.3 deriving HEAD from GET and answering OPTIONS
 *                            itself - a fact worth recording, not a prohibition.
 *
 * Collapsing those two into one "write verb" set is a mistake this repository has already made and
 * corrected once; the naming here is chosen so it cannot be made silently again.
 */
import ts from "typescript"

/** POST, PUT, PATCH, DELETE. Unsafe under RFC 9110 section 9.2.1; their absence is the no-write guarantee. */
export const STATE_CHANGING_METHODS: readonly string[] = Object.freeze(["POST", "PUT", "PATCH", "DELETE"])

/**
 * GET, HEAD, OPTIONS. Safe under RFC 9110 section 9.2.1 - none is a request to change anything.
 * TRACE is also safe and CONNECT is not, but Next.js route modules cannot export either, so neither
 * appears here: a set this file publishes must be a set it can actually classify.
 */
export const SAFE_METHODS: readonly string[] = Object.freeze(["GET", "HEAD", "OPTIONS"])

/**
 * The two safe methods next@16.3.3 will DERIVE when a route exports GET and does not export them.
 * GET is excluded because it is the thing being derived FROM, not a derivable handler.
 */
export const SAFE_METHOD_HANDLERS: readonly string[] = Object.freeze(["HEAD", "OPTIONS"])

/** Every method name a Next.js App Router route module may export as a handler. */
export const HTTP_METHODS: readonly string[] = Object.freeze([...SAFE_METHODS, ...STATE_CHANGING_METHODS])

/**
 * How the handler was declared. Every one of these is a real shape a Next.js route module may use;
 * the three marked MEASURED are the only three that occur in this tree today, and the counts are the
 * ones `check-http-method-classifier.ts` pins.
 */
export type MethodExportStyle =
    | "async function" // MEASURED: 95 state-changing, 74 GET
    | "function" //       MEASURED: 17 state-changing, 26 GET
    | "const" //          MEASURED:  4 state-changing,  2 GET
    | "let"
    | "var"
    | "re-export" // `export { handler as POST }` / `export { POST } from "./x"` - no site covered this

export type MethodExport = Readonly<{
    method: string
    style: MethodExportStyle
    /** True only for a declaration actually marked `async`. A `const` initialised to an async arrow counts. */
    isAsync: boolean
    /** 1-based, for a failure detail a reader can navigate to. */
    line: number
}>

export type RouteMethodExports = Readonly<{
    file: string
    exports: readonly MethodExport[]
    /** Every distinct method name exported, sorted. */
    methods: readonly string[]
    /** The exported methods that are state-changing, sorted. Empty means the no-write guarantee holds. */
    stateChanging: readonly string[]
    /** The exported SAFE-METHOD HANDLERS (HEAD, OPTIONS), sorted. Never a write claim. */
    safeMethodHandlers: readonly string[]
}>

function hasExportModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node)
        ? (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
        : false
}

function hasAsyncModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node)
        ? (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
        : false
}

/**
 * An initialiser is "async" only when it is literally an async function or arrow. A `const GET =
 * createBookingEventGet()` - which is the shape all six real `export const VERB` declarations in this tree
 * use - is NOT async by this test, and that is correct: whether the returned handler is async is a fact
 * about another function in another file, and claiming to know it from here would be a guess.
 */
function initialiserIsAsync(initialiser: ts.Expression | undefined): boolean {
    if (initialiser === undefined) return false
    return (ts.isArrowFunction(initialiser) || ts.isFunctionExpression(initialiser)) && hasAsyncModifier(initialiser)
}

function variableStyle(flags: ts.NodeFlags): MethodExportStyle {
    if ((flags & ts.NodeFlags.Const) !== 0) return "const"
    if ((flags & ts.NodeFlags.Let) !== 0) return "let"
    return "var"
}

/**
 * Classify one route module's handler exports.
 *
 * TOP-LEVEL STATEMENTS ONLY, deliberately. A `function POST` nested inside another function is not a
 * route handler no matter what it is called, and a regex cannot tell the difference. `export` is only
 * legal at a module's top level, so iterating `source.statements` is both the correct scope and the
 * complete one - with the single exception of a namespace body, which cannot contribute a module export
 * either and is therefore also correctly skipped by not recursing.
 *
 * `setParentNodes` is TRUE, matching `check-harness-exit-integrity.ts` and `check-assertion-vacuity.ts`.
 * Nothing here walks upward by hand, but `Node.getStart` consults the parent chain to decide how much
 * leading trivia belongs to the token, and the reported line number is the whole value of a failure detail
 * a reader has to navigate to. Getting that wrong to save an allocation on 154 files is a bad trade.
 */
export function classifyRouteModule(file: string, source: string): RouteMethodExports {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const found: MethodExport[] = []

    const record = (method: string, style: MethodExportStyle, isAsync: boolean, position: number) => {
        if (!HTTP_METHODS.includes(method)) return
        found.push(
            Object.freeze({
                method,
                style,
                isAsync,
                line: tree.getLineAndCharacterOfPosition(position).line + 1,
            }),
        )
    }

    for (const statement of tree.statements) {
        // `export [async] function VERB(...)`
        if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name !== undefined) {
            const isAsync = hasAsyncModifier(statement)
            record(statement.name.text, isAsync ? "async function" : "function", isAsync, statement.name.getStart(tree))
            continue
        }

        // `export const|let|var VERB = ...`
        if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
            const style = variableStyle(statement.declarationList.flags)
            for (const declaration of statement.declarationList.declarations) {
                // A destructuring pattern cannot name a handler export, so only an identifier is read.
                if (!ts.isIdentifier(declaration.name)) continue
                record(declaration.name.text, style, initialiserIsAsync(declaration.initializer), declaration.name.getStart(tree))
            }
            continue
        }

        /**
         * `export { POST }`, `export { handler as POST }`, `export { POST } from "./elsewhere"`.
         *
         * NO SITE COVERED THIS, and it is the cheapest way past all seven of them: none of the seven
         * regexes contains an alternative that can match it, because none of them is looking for anything
         * other than a declaration keyword. The EXPORTED name is what the framework dispatches on, so
         * `handler as POST` is a POST handler and `POST as handler` is not - which is why the alias is read
         * from `name` and never from `propertyName`.
         */
        if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
            for (const element of statement.exportClause.elements) {
                record(element.name.text, "re-export", false, element.name.getStart(tree))
            }
        }
    }

    // NOT named `exports`: ts-node compiles this module to CommonJS, where module-level exports are read
    // as `exports.NAME`, so a local binding called `exports` puts every one of them in a temporal dead
    // zone for the rest of this function - `HTTP_METHODS.includes` above then throws a ReferenceError at
    // runtime while type-checking perfectly. Found by running it.
    const methodExports = Object.freeze([...found])
    const distinct = (from: readonly string[]) =>
        Object.freeze([...new Set(methodExports.filter((e) => from.includes(e.method)).map((e) => e.method))].sort())

    return Object.freeze({
        file,
        exports: methodExports,
        methods: distinct(HTTP_METHODS),
        stateChanging: distinct(STATE_CHANGING_METHODS),
        safeMethodHandlers: distinct(SAFE_METHOD_HANDLERS),
    })
}

/** Does this route module export `method`, in ANY declaration style? */
export function exportsMethod(classified: RouteMethodExports, method: string): boolean {
    return classified.methods.includes(method)
}

/**
 * The no-write guarantee, as one predicate. TRUE means no POST, PUT, PATCH or DELETE handler is exported
 * in any style - including the two styles five of the seven old sites were blind to, and the re-export
 * shape none of them covered.
 *
 * This says NOTHING about HEAD or OPTIONS, and it must not: they are safe methods, and a surface that
 * exports either is still guaranteed not to write.
 */
export function exportsNoStateChangingMethod(classified: RouteMethodExports): boolean {
    return classified.stateChanging.length === 0
}

/**
 * The precondition for next@16.3.3 deriving both safe methods itself: GET exported, HEAD and OPTIONS not.
 *
 * NOT A PROHIBITION. Exporting HEAD or OPTIONS is legal and RFC-compliant. A caller reading `false` here
 * has learned that the framework is no longer deriving them, which means any assertion about the derived
 * behaviour has stopped describing this route - not that anything is wrong.
 */
export function frameworkDerivesSafeMethods(classified: RouteMethodExports): boolean {
    return exportsMethod(classified, "GET") && classified.safeMethodHandlers.length === 0
}

/** `GET, HEAD, OPTIONS`-style rendering, sorted the way next@16.3.3 sorts its own `Allow` header. */
export function describeMethods(classified: RouteMethodExports): string {
    return classified.methods.length === 0 ? "(none)" : [...classified.methods].sort().join(", ")
}
