# Scripts

Excluded from `tsc` via `tsconfig.json`. Run from `aiclone/`.

| Path | Use |
|---|---|
| `fixtures/` | Sample resume and rupee-menu text for import tests |
| `test-import.ts` | Import extractor smoke tests |
| `one-off/` | One-shot demo/debug (fill try-kits, Sylvie, blob preset, CDP) |

One-off scripts are not part of `npm run dev`. They expect `DATABASE_URL` in `.env`.
