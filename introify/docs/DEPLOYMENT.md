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
- Codex on production: set `CODEX_HOME` to a persistent directory outside the
  deploy tree (sibling of uploads, not inside it) and `CODEX_AUTH_JSON` to the
  local `~/.codex/auth.json` body. Never commit that file. Stripe is still
  skipped.
- The new production database contains the deployment bootstrap data. Existing
  local development records have not been copied to Neon.

## Codex credential persistence

`CODEX_AUTH_JSON` accepts JSON or standard base64 and seeds a private `auth.json`
under `CODEX_HOME`. Keep this directory outside both the deployment and public
uploads. The production process must be able to create and atomically replace
the file; a persistence failure stops credential loading or refresh.

An unchanged environment seed preserves tokens refreshed by the app. Changing
the seed replaces saved credentials once. Existing files from before seed
tracking keep their current tokens; set or change `CODEX_AUTH_REVISION` only when
deliberately replacing such a login. Never commit credential payloads.

Refresh requests are coordinated within one app process. Copying a desktop
login to the server still shares the same OAuth session and account allowance;
separate machines or processes can race token rotation. A private `CODEX_HOME`
does not create an independent session. For general public API integrations,
OpenAI recommends Platform API keys; see the [authentication guidance](https://learn.chatgpt.com/docs/auth).

After configuration, use **Test chat** at `/admin/ai` and confirm a nonempty reply
plus a successful Codex entry in Recent calls. Then send a separate message on
`/demo` and verify its reply. Public profile chats do not currently create
`AiCallLog` entries. Configured badges and capacity rows show credential presence,
not provider health. Provider selection fallbacks do not retry failed requests.

## Redeployment checks

After deploying the latest branch in Hostinger, verify the homepage, `/demo`,
`/sign-in`, `/api/health`, and a bundled upload. An unauthenticated request to
`/dashboard` must redirect to sign-in. Check Hostinger runtime logs if a page
returns an error. Database migrations and bootstrap output appear in build logs.
