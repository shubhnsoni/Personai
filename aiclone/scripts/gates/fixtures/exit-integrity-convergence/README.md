# exit-integrity-convergence fixtures

Adversarial inputs for `scripts/one-off/check-harness-exit-integrity.ts`, exercised by its
`--self-test` flag. They cover the one thing the old implementation could not do: reach the helper
coverage fixed point without an arbitrary iteration cap.

| fixture | what it is | old bounded implementation | current worklist |
| --- | --- | --- | --- |
| `alias-cycle.ts.txt` | a mutually-recursive alias pair (`const cyclicA = cyclicB; const cyclicB = cyclicA`) plus a five-link alias chain declared in reverse dependency order | 4 passes resolved 4 links; `ok5` was never registered, so the frozen verdict was reported **clean** | converges; `ok5` registered; `REAL_DEFECT` |
| `wrapper-cycle.ts.txt` | a reachable wrapper cycle (`ping` ⇄ `pong`, `pong` calls the real helper) plus a four-link wrapper chain in reverse dependency order | 2 passes resolved `lvl1`/`lvl2`; `lvl4` was never registered, so the frozen verdict was reported **clean** | converges; each cycle member registered once; `REAL_DEFECT` |

## Why `.ts.txt` and not `.ts`

These files are **source text handed to a parser**, not modules. Both deliberately contain code
that could not compile — `const ok5 = ok4` is declared before `ok4` exists, on purpose, because
declaration order is exactly what the old caps were sensitive to. `aiclone/tsconfig.json` excludes
`scripts/`, but `eslint.config.mjs` does not, so a `.ts` extension here would put adversarial
non-compiling text in front of the repository linter. The `.ts.txt` extension keeps the fixtures
adversarial without making the toolchain lie about them.

The scanner is handed a synthetic `*.ts` filename when it parses these, so TypeScript's parser sees
them as TypeScript regardless of the on-disk extension.

## Adding one

Add the file here, then add an entry to `ADVERSARIAL_FIXTURES` in
`scripts/one-off/check-harness-exit-integrity.ts`. A declared fixture whose file is missing or
unreadable is a self-test FAILURE, not a skip.
