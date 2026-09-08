import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * The repository's first UI test runner (U4).
 *
 * WHY THIS SHAPE
 * --------------
 * - NO `esbuild.jsx` OPTION. An earlier draft of this file set `esbuild: { jsx: "automatic" }`
 *   on the theory that Vite reads its own transform options rather than tsconfig's
 *   `"jsx": "react-jsx"`. That reasoning is obsolete for this dependency set and was measurably
 *   wrong twice over:
 *     1. Vitest 4.1.11 ships the Rolldown/oxc pipeline, and it printed
 *        "Both esbuild and oxc options were set. oxc options will be used and esbuild options
 *        will be ignored" - so the option never affected a single transform.
 *     2. `ESBuildOptions` has no `jsx` property, so the option was also a type error, and
 *        because `next build` runs `tsc` across every TypeScript file in the package, it
 *        FAILED `npm run build`.
 *   oxc transforms `.tsx` with automatic JSX by default, which is why the smoke test compiled
 *   and passed even while the option was being ignored. Stating nothing is both correct and
 *   the smallest thing that works.
 * - `.mts`, not `.ts`. Loaded as CommonJS a `.ts` config makes Vite warn about ESM syntax; the
 *   alternative (`"type": "module"` in package.json) would change module resolution for the
 *   whole Next app and the ts-node Prisma seed, which is far outside a test runner's business.
 * - `environment: "jsdom"` gives a real DOM, real event dispatch and a real document, which is
 *   the whole point: the previous wave could only run `renderToStaticMarkup`, so every
 *   click-, timer- and portal-driven behaviour in this codebase was untestable.
 * - `alias` mirrors the single `@/*` path mapping in tsconfig.json. Vitest does not read
 *   tsconfig paths on its own and adding vite-tsconfig-paths for one mapping is not justified.
 * - `include` is scoped to tests/, so a future `next build` or a stray `src/**` file is never
 *   collected as a test.
 */
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        setupFiles: ["./tests/setup.ts"],
        // These files deliberately replace process-wide browser primitives (matchMedia, fetch,
        // fake timers) and import several large Next server/client graphs. Running files in
        // parallel made the importability guard intermittently spend its whole 5s budget waiting
        // on transforms from unrelated files; the same import completes in ~1.2s in isolation.
        // Serial files keep both the global stubs and the bounded import timeout deterministic.
        fileParallelism: false,
        // Every test in this suite drives fake timers and global stubs. Restoring them between
        // tests keeps one file's matchMedia stub from leaking into the next.
        restoreMocks: true,
        unstubGlobals: true,
        unstubEnvs: true,
    },
})
