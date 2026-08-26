# Handoff — PersonaLink (`personai`)

Written 2026-08-24, section 1 updated 2026-08-26. Covers what this project is,
what was lost and how it was recovered, how the repo and artifacts are organised,
and what is still open.

---

## 1. Current state

| | |
|---|---|
| Checked-out branch | `recovered/aug20-wt-pr-32` — **the canonical branch; `origin/main` is not where the work is** |
| HEAD | `8805bc8` |
| Working tree | clean |
| Commit identity | `shubhnsoni <shubhamprasadsony@gmail.com>` (repo-local; global config untouched) |
| Pushed? | **Yes.** `origin/recovered/aug20-wt-pr-32` is up to date as of 2026-08-26 |

The app is `aiclone/` — Next.js 16.0.6 (App Router, Turbopack), Prisma 5.22 on
PostgreSQL, Clerk for auth, Stripe for payments, OpenAI for chat.

290 source files, 35 Prisma models.

### What is preserved, and what is not

*Added 2026-08-26, after pushing everything to GitHub.*

| | Where it lives | Survives losing this machine? |
|---|---|---|
| source, docs, scripts | GitHub | yes |
| AR models served to users (63 MB) | GitHub, commit `8805bc8` | yes |
| **database content** | local Postgres only | **no** — see `../backups/README.md` |
| **`ar-raw/`, 1.67 GB of raw Meshy exports** | this disk only | **no** |
| **`aiclone/.env` values** | this disk only | **no** — keys are *named* in `.env.example` |

The database holds 16 profiles, 234 products (214 of them the SkyDine menu), 35
reviews and 99 chat messages, and none of it is in the repo. Current tally:

```bash
node --env-file=.env scripts/one-off/db-inventory.mjs
```

Dumps live in `../backups/` and are gitignored deliberately — they contain real
visitor conversations, a lead and user emails, and this repository is **public**.
A verified dump from 2026-08-26 is already there.

The Postgres service (`postgresql-x64-17`) is set to **Manual** start and stopped
mid-session on 2026-08-26, taking the dev server with it. Automatic would avoid
the surprise.

### Known credential exposure

`aiclone/.env` was committed in the initial commit and modified in `44a2e39`. Both
are ancestors of the already-published `origin/main`, and the repo is public — so
this leaked before any of the recent work and is not something a future push can
avoid. The one value in genuine format is `CLERK_SECRET_KEY` (`sk_test_…`, 40
chars): **rotate it.** The Stripe and OpenAI values are too short to be valid
keys, and `DATABASE_URL` was a SQLite path with no password. Rewriting history
would not undo the exposure; rotating is the fix that works.

---

## 2. What this product is

A creator/professional publishes one link. Visitors land on a public profile and
talk to an **AI persona** of that person, which answers from their knowledge
base, books calls, captures leads, and sells digital products, courses, events
and community access. There is a signature animated **orb** UI representing the
persona, plus restaurant-specific features (menu, reservations, AR dish capture).

---

## 3. What was lost, and why

Work done **16–20 August 2026** never existed in this repository. It was done in
a temporary git worktree:

```
C:\Users\shubh\AppData\Local\Temp\grok-shubh\wt-pr-32\aiclone
```

That directory was later gutted. Every source file was deleted **except those
whose paths contain square brackets** — `[id]`, `[slug]`, `[uuid]`. That
signature (only bracketed names surviving) is what a wildcard/glob deletion
leaves behind, since `[...]` is a character class that won't match a literal
path. Combined with the location being `%LOCALAPPDATA%\Temp`, this looks like
automated cleanup.

Ruled out as recovery routes: no commits after 2026-08-16 11:55, no stash, no
dangling commits, Recycle Bin empty of matches, `origin` had nothing pushed, and
editor local history only went back to Dec 2025.

---

## 4. How it was recovered

The Grok CLI session log survived outside `Temp`, in `~/.grok/sessions/`. Its
`updates.jsonl` records every `write` and `search_replace` tool call **with full
file content**.

Method:

1. Scanned all 105 `updates.jsonl` files (256 MB) for operations targeting the
   lost worktree.
2. Replayed them in timestamp order onto the `pr-32` tip (`b499f9a`) as baseline.
   Timestamps are Unix **seconds**, not ISO.
3. File *creation* is encoded as a `search_replace` with an **empty
   `old_string`** — recognising that recovered 39 files that would otherwise
   have been lost.
4. One bulk padding rewrite had been done via a PowerShell command, so it never
   appeared in the edit log. Found the command and replayed its four regex
   substitutions.
5. The `src/lib/bloub/*` orb modules were copied in by a shell command from a
   clone of `bloub.vercel.app`. The working files were gone but the **git pack
   survived** in `Temp\bloub-src\.git\objects\pack`; extracted them from it.

**Validation:** 8 files survived the deletion on disk (the bracketed ones). All
**8 of 8** reconstruct byte-identical. That is independent ground truth that the
replay is faithful.

Result: **275 files** restored, 244 with every recorded edit applied.

### Fixes applied after recovery

| Commit | Fix |
|---|---|
| `b887a6c` | duplicated `const money = useMoney()` in `store-panel.tsx` — a replay artifact that broke **every** public profile page with an Ecmascript compile error |
| `425b6f2` | Google login crashed with `Unique constraint failed on the fields: (email)`. `syncUser` looked up only by `clerkId`; now falls back to an email lookup and re-links the row, requiring a Clerk-verified email |
| `e3db19f` | three identifiers the replay dropped: `DollarSign`, `Badge`, and `KINDS` (a scope problem — threaded in as a prop) |
| `c76a34a` | Clerk keyless prompt overlapping the sign-in Continue button |
| `75ab116` | PDF import crashed on NUL bytes (`22021 invalid byte sequence`). Sanitises at three boundaries, including the server action that writes client-supplied nested data |
| `c62224e` | `next build` typecheck was pulling in dev-only generated types and ad-hoc `scripts/` |

---

## 5. Branch map

| Branch | What it is |
|---|---|
| **`recovered/aug20-wt-pr-32`** | **The one to use.** Recovered Aug 20 work + all fixes |
| `backup/dirty-worktree-2026-08-24` @ `417a748` | Snapshot of the uncommitted tree as found before any changes |
| `execute-plan/908ef26f-pr-1 … pr-37` | 37 branches from an earlier agent run. `pr-37` is the most integrated, but **no single branch contains everything** — 20 others hold unique commits |
| `main` / `replit-agent` | Older history |

The 37 `execute-plan` branches were built in temp worktrees that no longer
exist; the stale worktree registrations were pruned.

---

## 6. Repo layout

```
personai/
├── README.md                   pointer into aiclone/
└── aiclone/                    the Next.js app (this is the project)
    ├── README.md
    ├── docs/
    │   ├── HANDOFF.md          this file
    │   └── attached-assets/    early design dumps
    ├── prisma/
    │   ├── schema.prisma       35 models
    │   ├── seed.ts
    │   ├── sql/
    │   └── migrations/         5 (see caveat below)
    ├── scripts/
    │   ├── fixtures/           import test data
    │   ├── test-import.ts
    │   └── one-off/            demo fill, Sylvie, debug
    ├── public/uploads/         user/demo images (gitkeep)
    └── src/
        ├── app/     112 files  routes
        ├── components/ 116     UI
        └── lib/      61        server + shared logic
```

### `src/app` routes

| Path | Purpose |
|---|---|
| `[slug]/` | the public profile — chat, shop, menu, book, reserve, courses, events |
| `dashboard/` | creator admin — inbox, money, offer, import, calendar, products, courses, events, leads, orders, profile |
| `library/` | customer area for purchased content, with its own login |
| `qa/` | internal page listing every demo profile — useful for testing all role types |
| `onboarding/` | role-aware first-run wizard |
| `api/` | chat, bookings, stripe, webhooks, downloads, embeddings, image-to-3d, upload, health |
| `(auth)/`, `sign-in/`, `sign-up/` | auth screens — **note the duplication in §8** |
| `l/` | short-link redirects |
| `actions/` | server actions |

### Notable `src/lib`

`auth-sync.ts` (Clerk↔DB user sync), `rag.ts` + `embeddings.ts` (knowledge
retrieval), `import-extract.ts` (the big content importer), `bloub/` (orb
engine), `slots.ts` (booking maths), `surfaces.ts` (which features a role sees),
`stripe.ts`, `storage.ts`, `rate-limit.ts`.

---

## 7. Running it

```bash
cd aiclone
npm install
npx prisma generate
npm run dev -- --hostname 0.0.0.0 --port 3000
```

`.env` is gitignored and already present locally. To share a preview:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

Each quick tunnel gets a new random hostname; they are single-use.

The database is `personalink` on `127.0.0.1:5432`. All 35 tables already exist
and match the schema — **no migration is needed**.

---

## 8. Open items

1. **~20 TypeScript errors** block `next build`. Compilation itself succeeds in
   about 50s; these are strictness issues (null checks, argument variance) that
   don't affect runtime, which is why dev has been fine. Fixing them is what
   stands between you and a production build — which would also remove the dev
   error overlay that external testers see.
2. **`prisma/migrations/migration_lock.toml` says `sqlite`** while the schema is
   `postgresql`, so `prisma migrate` fails with P3019. Harmless for running the
   app (schema was pushed, not migrated) but blocks future `migrate dev`.
3. **Clerk runs keyless** (`.clerk/.tmp/keyless.json`). This is why user IDs
   churn — the original login crash came from exactly that. Adding real Clerk
   keys removes the churn *and* the keyless prompt that `c76a34a` works around.
4. **`/sign-in` is defined twice** — `app/(auth)/sign-in/[[...sign-in]]` and
   `app/sign-in/[[...sign-in]]` both resolve to it. The `(auth)` one wins; the
   other (`AuthShell`) is dead code. Also `AuthScreen` mounts **both** `<SignIn>`
   and `<SignUp>` at once and hides one with CSS.
5. **Hydration warning on the sign-in page** is Clerk-internal — its
   `ClerkHostRenderer` injects a mount div that isn't in the server HTML. React
   labels it *Recoverable* and the form works. It only surfaces because the dev
   overlay is on.
6. **29 edits across 19 files** could not be anchored during the replay. Most
   were already applied in the base commit; the three that mattered are fixed in
   `e3db19f`. `src/lib/bloub/{skins,expressions}.ts` remain partial.
7. ~~**Nothing is pushed.**~~ Resolved 2026-08-26: everything is committed and
   `origin/recovered/aug20-wt-pr-32` is up to date. Note `origin/main` is still at
   the initial commit, so the feature branch is the canonical one until merged.
8. **Rotate `CLERK_SECRET_KEY`** — it is in already-published history in a public
   repo. See section 1.
9. **Nothing but this disk holds the database or `ar-raw/`.** See section 9.
10. **iOS AR Quick Look is unconfirmed.** The `rel="ar"` anchor and the
   `model/vnd.usdz+zip` header are in place and all 10 `.usdz` files pass
   `scripts/one-off/check-usdz.mjs`, but it has never been observed working on a
   real iPhone. Android is signed off and pinned — see `docs/AR.md`.
11. **`shop/page.tsx` fabricates product ratings** (`downloadCount > 0 ? 4.5 : …`)
   while the AR page averages real `OfferReview` rows. Worth reconciling.

---

## 9. Artifacts outside the repo

| Location | Contents | Keep? |
|---|---|---|
| `personai\backups\` | Verified `pg_dump` of the local database — the only copy of 16 profiles, 234 products, 35 reviews, 99 messages. Gitignored: holds real conversations and emails, and the repo is public | **Yes. Copy it off this machine** |
| `personai\ar-raw\` | 1.67 GB: raw ~90 MB Meshy exports per dish, the compression intermediates, and a 32 MB zip of the generated outputs. Gitignored | Yes, unless you would rather re-pay for the models |
| `Desktop\personai-recovery-evidence\` | 1.16 GB insurance copy: surviving `wt-pr-32` files, the bloub git pack, the full Grok session (`updates.jsonl`), the chat history, and the replay scripts | Yes, until you're confident the recovery is complete |
| `Desktop\domain-hunt\` | Unrelated to the code — the `.com` naming search. `csv/` has the shortlists, `README.md` explains it | Independent of the app |

The evidence folder exists because the originals lived in `%LOCALAPPDATA%\Temp`,
which Windows can purge at any time.

The first two rows are on one disk with no second copy anywhere. That is the whole
gap between "committed" and "preserved".

---

## 10. If you need to recover something again

The replay tooling is in
`Desktop\personai-recovery-evidence\recovery-scripts\`:

- `recover.mjs` — the replay: reads `updates.jsonl`, rebuilds files, validates
  against survivors, reports skipped edits
- `analyze.mjs` — inventories tool-call shapes in the logs
- `report.json` — per-file outcome of the last run

Adjust `WT_PREFIX` and the baseline ref for a different worktree. The critical
details are in §4: Unix-second timestamps, empty `old_string` meaning file
creation, and terminal-command edits being invisible to the log.
