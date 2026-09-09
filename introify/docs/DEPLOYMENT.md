# Introify production deployment

Production URL: https://introify.com

## One-click deployment from Windows

Double-click **`deploy.cmd` in the repository root** after saving your changes.
It validates the release, commits the selected changes on `main`, and pushes
to `shubhnsoni/Personai`. Hostinger must have automatic deployment enabled for
that branch. The launcher waits for `/api/health` to return the exact commit in
its `x-introify-release` header, then checks the homepage and sign-in page.
A successful push alone is not reported as a live deployment. Missing or stale
release headers stop verification after the timeout; inspect Hostinger build logs.

The launcher requires Git, Windows PowerShell 5.1+, and Node 24 for UI tests.
It finds or provisions pinned Node 20.20.2 for the production Webpack build.
Its default scope includes modified tracked app files, new source/tests/public
assets, and the root deployment scripts. It excludes local secrets and output,
new uploads, `.env.example`, historical untracked documentation, and the old
`_edge_cdp.py` utility. It refuses another branch, an unexpected origin, an
unfinished Git operation, or already staged work. It never uses `git add .`.
New migrations, maintenance scripts, or app configuration outside the automatic
scope stop the launcher for explicit file selection, so a schema change cannot
silently ship without its new migration.

For a precise release, run PowerShell from the repository root:

```powershell
./scripts/deploy.ps1 -Files @(
  'introify/src/components/dashboard/mobile-sidebar.tsx',
  'introify/tests/mobile-business-navigation.test.tsx'
) -Message 'Improve the mobile menu' -NoPause
```

Include every file needed by your change. `-Files` takes literal file paths;
`.env.example` is permitted only when explicitly selected. `-Tests` optionally
sets the focused unit/UI test list using app-relative `tests/...test.tsx` paths;
changed unit/UI tests are also included. Database integration suites run separately,
outside this deployment launcher. The normal default checks dashboard access,
business switching, and page transitions. `-NoPause` is for terminal/agent use;
double-click mode keeps its result visible until Enter is pressed.

Before committing, the launcher archives the prospective Git tree into ignored
`.local/release-*`, supplies dummy validation configuration, disables providers,
and runs tests plus a Node 20 Webpack build. It does not load a local `.env`, use
production credentials, migrate a database, or bootstrap production data. Existing
dependencies are shared only after checking the lockfile and generated Prisma
schema. If that check fails, it performs an independent `npm ci` and Prisma client
generation inside the snapshot; `-InstallDependencies` also forces this path.
Generated client files
in the working app are never changed through the shared dependency junction.

The selected files and branch are checked again before staging and committing;
edits made during validation require another run. Validation snapshots remain
under `.local` for inspection. A failed check does not push. A rejected push or
Hostinger timeout leaves any already created local commit available for review
and a later retry. Production migrations and bootstrap run only in Hostinger's
configured hosting build below. Live provider, payment, and signed-in workflow
checks still follow the launch checklist.

## Hosting

- Hostinger website: `introify.com`
- Repository: `shubhnsoni/Personai`, branch `main`, root `introify`
- Runtime: Node.js 20.x
- Build command: `npm run build:hostinger`
- Output directory: `.next`
- Persistent uploads: `/home/u323815761/domains/introify.com/uploads`

Hostinger's older Linux libraries cannot load Next.js's native SWC compiler.
The deployment uses `next.config.mjs` and Webpack, which supports the WASM
compiler fallback. Local development can continue using the normal dev command.

The build applies pending Prisma migrations, creates missing welcome presets and
the demo profile without replacing existing records, then builds the application.
Upload URLs remain `/uploads/...`; persisted files take precedence over bundled
demo assets. Keep the uploads directory when redeploying or restoring builds.

Hostinger migrations use `DIRECT_URL` when supplied. Otherwise, the migration
wrapper converts a recognized Neon pooled hostname to its direct counterpart;
other database URLs stay unchanged. Only the Prisma migration child process gets
this connection. Normal app traffic and bootstrap retain `DATABASE_URL`.
Direct connections preserve the session needed by migration advisory locks;
see [Neon's pooling limitations](https://neon.com/docs/connect/connection-pooling).
The wrapper keeps locking enabled and reports failures without blindly retrying.

### Missing ArBuild migration prerequisite

`20260909110000_ar_build_foundation` adds the legacy `ArBuild` table that was
present in the Prisma schema but missing from the tracked migration chain.
It runs before the unchanged `20260909120000_platform_billing` migration.
An existing AR table, its rows and foreign-key policies are preserved.

The hosting build first runs `scripts/recover-billing-baseline.mjs`. This handles
only the verified first-statement billing failure: PostgreSQL `42P01` for the
missing `ArBuild` table, the expected migration checksum, zero applied steps,
the required legacy tables, and no billing tables, indexes, sequence or added
columns. After those checks it uses Prisma's supported `migrate resolve --rolled-back`
command to clear that failed record; normal migration deployment
then applies the prerequisite and billing migration. With no failed record it
does nothing. Any different or partially applied state stops for review.
The original billing SQL stays immutable. This recovery does not reset the
database, delete business data or roll back existing schema changes.

## Services

- Neon project: `introify` (`icy-boat-80075899`), AWS Singapore, production branch.
- Clerk: production instance for `introify.com`; DNS, TLS and mail verified.
- Clerk account portal: https://accounts.introify.com/sign-in
- Google Cloud project prepared for OAuth: `steadfast-sound-508011-c2`.

Production database and Clerk credentials are stored in Hostinger environment
variables. Never commit them or copy production secrets into this document.
The deployment also sets the app URL, Clerk route redirects and administrator
email allowlist in Hostinger.

## Deferred configuration

- Google OAuth is enabled on the production Clerk instance. Email sign-in still
  works independently.
- Commercial AI, platform payments and photoreal generation require the provider
  activation checks below and in [the billing launch checklist](BILLING_LAUNCH_CHECKLIST.md).
  Implemented integrations and configured credentials do not establish live readiness.
- The new production database contains the deployment bootstrap data. Existing
  local development records have not been copied to Neon.

## API provider configuration

Published business assistants and metered import enrichment share the explicit
provider configuration in [`ai-runtime.ts`](../src/lib/ai-runtime.ts). For API
access, configure OpenAI or xAI below; the Codex connection follows this section.
Use [`.env.example`](../.env.example) for variable names and configure their real
values privately in Hostinger. Do not put keys or personal authentication files
in source control, public uploads or this document.

1. Choose and fund the provider account. Set `INTROIFY_AI_PROVIDER` to `openai`
   or `xai`, and supply the corresponding `OPENAI_API_KEY` or `XAI_API_KEY`.
2. Set `INTROIFY_AI_FAST_MODEL`, `INTROIFY_AI_SMART_MODEL` and
   `INTROIFY_AI_REASONING_MODEL` explicitly for every mode being offered.
   Each model must be in the selected provider's approved mode list in
   `ai-runtime.ts` and available to that provider account. Missing or unsupported
   mappings leave that mode unavailable; a key by itself does not activate it.
3. Keep `INTROIFY_AI_DISABLED=true` while the service should be unavailable.
   Set it to `false` when the provider and operating checks are complete. This
   flag controls the commercial runtime independently of legacy diagnostic settings.
4. For cost reporting, supply verified per-model input/output rates using
   `INTROIFY_AI_<MODE>_INPUT_USD_PER_MTOK` and
   `INTROIFY_AI_<MODE>_OUTPUT_USD_PER_MTOK`, where `<MODE>` is `FAST`, `SMART`
   or `REASONING`. Unset rates are reported as unknown, not zero.
5. Restart/redeploy after configuration. Check the commercial-mode section at
   `/admin/ai`, then use authorized test profiles with the appropriate plan
   entitlements to verify each advertised mode through the published assistant.
   Confirm real replies, usage reservations/settlement, and unavailable/error
   behavior. Configuration badges and the public Fast-mode availability summary
   do not prove provider health or Smart/Reasoning availability.

### Codex connection

The owner requested the existing local Codex connection for production. Set
`INTROIFY_AI_PROVIDER=codex`, Fast to `gpt-5.6-luna`, Smart to `gpt-5.6-terra`
and Reasoning to `gpt-5.6-sol`. A login alone does not activate visitor replies:
the explicit mappings and `INTROIFY_AI_DISABLED=false` are still required.
Plan entitlements, credit reservations, idempotency and business permissions
apply to Codex exactly as they do to API providers.

Use a dedicated writable persistent `CODEX_HOME`, outside the repository,
web root and uploads; the Hostinger path is `/home/u323815761/.introify-codex`.
Seed it privately with `CODEX_AUTH_JSON` (JSON or base64 of a Codex `auth.json`)
and a `CODEX_AUTH_REVISION`. New or rotated logins must change the revision.
The server persists refreshed tokens with private file permissions and serializes
refreshes inside the app process. Do not share this directory with another
process/replica. Never commit a login, expose it in browser code, or log tokens.
[OpenAI's headless authentication guide](https://learn.chatgpt.com/docs/auth#login-on-headless-devices)
documents device login and private auth-cache transfer.

Codex account limits are shared across assistants; subscription access does not
provide unlimited capacity. This existing adapter requests streamed responses
with only the offered business tool, no shell/filesystem/browser tools. It caps
request time at 45 seconds and delivered output bytes, cancels on disconnect,
and requires a completed event. The Codex endpoint does not support the API's
token-output cap; reasoning tokens can exceed the delivered-text budget. Actual
token usage is recorded when returned, and dollar cost remains unknown rather
than applying API prices to subscription access. Monitor provider limits and
held reservations before increasing traffic.

The legacy diagnostic controls at `/admin/ai` remain separate. Saved defaults
and diagnostic pings do not select the visitor runtime or test customer credit
accounting. Verify a real published reply and its ledger settlement after deployment.

For subscription/pack webhooks, legal approval, durable worker/storage and 3D
provider activation, follow [BILLING_LAUNCH_CHECKLIST.md](BILLING_LAUNCH_CHECKLIST.md).
Use [BILLING_IMPLEMENTATION.md](BILLING_IMPLEMENTATION.md) for current plans and
accounting behavior and [PENDING_ITEMS.md](PENDING_ITEMS.md) for the consolidated
remaining work. AI setup does not by itself enable paid checkout or photoreal generation.

## Redeployment checks

After deploying the latest branch in Hostinger, verify the homepage, `/demo`,
`/sign-in`, `/api/health`, and a bundled upload. An unauthenticated request to
`/dashboard` must redirect to sign-in. Check Hostinger runtime logs if a page
returns an error. Database migrations and bootstrap output appear in build logs.
