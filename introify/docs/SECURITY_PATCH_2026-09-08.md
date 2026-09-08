# Hostinger dependency security patch — 2026-09-08

Hostinger's 18:57 scan reported 18 advisory/package-version combinations:
10 high, 7 moderate, and 1 low. These correspond to six package families in
`npm audit` (4 high, 1 moderate, 1 low). The production-only dependency audit
reported zero findings before this patch; all flagged entries belong to the
ESLint development-tool dependency graph.

## Updated lockfile

| Package | Previous | Patched resolution |
| --- | --- | --- |
| `@babel/core` | 7.29.0 | 7.29.7 |
| `@humanfs/node` | 0.16.7 | 0.16.8 |
| `brace-expansion` | 1.1.12 / 5.0.4 | 1.1.18 / 5.0.9 |
| `browserslist` | 4.28.1 | 4.28.9 |
| `flatted` | 3.3.3 | 3.4.4 |
| `js-yaml` | 4.1.1 | 4.3.2 |

The update stays within existing parent dependency ranges. Associated Babel,
HumanFS, and browser-data dependencies were refreshed as needed. Package
manifest ranges, Next.js, React, Clerk, application code, and database schema
are unchanged.

The lockfile was updated with targeted `npm update --package-lock-only
--ignore-scripts` so the running local development server's dependencies were
not replaced. Validation installs the revised graph separately.

## Verification

- Independent full and production-only npm audits both report zero findings.
- All 18 Hostinger advisory/package-version combinations resolve to patched
  versions. No changed or added declared Node engine excludes Hostinger's
  Node 20.19.4 runtime.
- A separate clean install with Node 20.20.2 / npm 10.8.2 preserves the lockfile
  exactly. Prisma generation and representative TS/TSX ESLint checks pass.
- The complete production Webpack/WASM build passes on Node 20, including
  TypeScript, all 10 static pages, and build traces.
- 131 focused regression tests pass across 11 files on Node 24.19.0. One cold
  worker-start timeout was rerun successfully after the concurrent build ended.
  The unchanged jsdom test dependencies require a newer Node than the host;
  this does not affect the successful Node 20 production build.

An advisory scan detects known dependency issues; zero findings is not a claim
that the entire application has undergone a security review.

## Advisory references

- [Babel source-map file read](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8)
- [HumanFS symlink copy disclosure](https://github.com/advisories/GHSA-p498-v437-472g)
- [Brace expansion CPU and memory exhaustion](https://github.com/advisories/GHSA-rgw5-rvv9-x895)
- [Browserslist memory exhaustion](https://github.com/advisories/GHSA-c83g-rgw3-j3cx)
- [Browserslist custom statistics handling](https://github.com/advisories/GHSA-73wf-gq98-2v4g)
- [Flatted prototype pollution](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh)
- [JS-YAML CPU exhaustion](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)
