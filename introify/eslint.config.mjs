import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // P1-009, first slice. The rule stays ON; it is configured to respect the
    // convention this codebase already uses.
    //
    // A leading underscore is how this repository marks something as deliberately
    // unused — an interface parameter it must accept but does not read, a destructured
    // sibling it is discarding, a placeholder it is keeping for symmetry. Fifteen of
    // the reported violations were `_request`, `_available`, `_calendarId`, `_startDate`,
    // `_endDate`, `_uuid` and `_RemovedProductsView`: all of them already saying "unused
    // on purpose" and being told off for it. Renaming them to satisfy a linter that does
    // not know the convention would be churn; teaching the linter the convention is the
    // actual fix.
    //
    // Genuinely dead identifiers WITHOUT the underscore are still reported, which is the
    // point — the remaining warnings are now signal rather than noise.
    name: "p1-009/unused-vars-honours-underscore-convention",
    rules: {
      "@typescript-eslint/no-unused-vars": [
        // Severity is left exactly as eslint-config-next sets it, which is "warn".
        // Verified by measurement, not memory: before this change the repository reported
        // 53 errors and 61 warnings, and the error total was fully accounted for by
        // no-explicit-any (24), set-state-in-effect (10), no-html-link-for-pages (8),
        // preserve-manual-memoization (3), refs (2), no-empty-object-type (2),
        // no-unescaped-entities (1) and no-require-imports (3). Unused vars were
        // therefore warnings. This slice changes configuration only: it neither lowers
        // nor raises a gate.
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // One-off maintenance scripts with a `.js` extension are CommonJS by extension and
    // always have been; `require()` is correct there, not a lapse. Converting them to
    // ESM to satisfy a TypeScript-oriented rule would risk breaking working scripts for
    // no benefit. Scoped narrowly so application code still cannot use `require()`.
    name: "p1-009/commonjs-one-off-scripts",
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
