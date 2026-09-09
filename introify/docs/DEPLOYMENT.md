# Introify production deployment

Production URL: https://introify.com

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

## Commercial AI configuration

Published business assistants and metered import enrichment use explicit
OpenAI or xAI API configuration from [`ai-runtime.ts`](../src/lib/ai-runtime.ts).
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

The legacy diagnostic controls at `/admin/ai` are separate. Personal Codex
authentication, saved diagnostic defaults and diagnostic pings do not select
or activate the commercial visitor runtime. Diagnostic pings can incur provider
charges and do not test customer credit accounting. Do not copy a personal
Codex login to enable public AI.

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
