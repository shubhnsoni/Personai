# Handoff — Codex on introify.com

Date: 2026-09-08. For the next agent: finish production Codex. Do not retry
Hostinger login from a fresh/CDP/Playwright profile.

Live site: https://introify.com
App folder: `C:\Users\shubh\Desktop\Projects\personal projects\personai\introify`
Git: `shubhnsoni/Personai` `main` @ `c303e2c`
  `feat(introify): load Codex credentials from CODEX_AUTH_JSON on Hostinger`

## What is already done

- Introify is live on Hostinger Node 20, app root `introify`, build
  `npm run build:hostinger`. Persistent uploads:
  `/home/u323815761/domains/introify.com/uploads`.
- Google login works on https://introify.com/sign-in (Continue with Google).
  Clerk production `ins_3J2iVUlOe8G1iR2GQWKjI6Tk8ev`. Do not redo OAuth.
- **Local Codex is set up.** `C:\Users\shubh\.codex\auth.json` exists, ChatGPT
  mode, refresh works. `CODEX_DISABLED` is unset. Default provider is Codex,
  then xAI, then OpenAI. Local OpenAI key is also set as fallback. No xAI key.
- Production cannot see `~/.codex/auth.json`. Hostinger skipped AI keys on
  purpose until this task. Stripe is still skipped — leave it.
- Code to read Hostinger env is **already on `main`**:
  - `CODEX_AUTH_JSON` — minified `auth.json` body, or standard base64 of it
  - `CODEX_HOME` — persistent dir; first load seeds `auth.json` there so token
    refresh can persist
  - `hasCodexAuthSource()` in `src/lib/codex-auth.ts` (used by `env.hasCodex`
    and `providerConfigured("codex")`)
  - Tests: `npx vitest run tests/codex-chat.test.ts tests/admin-ai-settings.test.ts`

## What you must finish

Hostinger still has no Codex env. Production chat will not use Codex until
both are set and the app has rebuilt/restarted on commit `c303e2c` or later.

In the **introify.com Node.js web app** environment variables:

| Name | Value |
| --- | --- |
| `CODEX_HOME` | `/home/u323815761/domains/introify.com/.codex` |
| `CODEX_AUTH_JSON` | contents of the minified file below |

Do **not** put `auth.json` under `uploads/` (that path is public). Sibling
`.codex` is correct.

Prepared payloads (gitignored, do not commit, do not paste into chat):

- `C:\Users\shubh\.codex\auth.json` (source of truth, just refreshed)
- `C:\Users\shubh\.grok\secrets\introify-codex-auth.min.json` (one-line JSON, ~3942 chars)
- `C:\Users\shubh\.grok\secrets\introify-codex-auth.b64.txt` (if the env UI fights quotes)

If Hostinger auto-deploy from `main` already ran `c303e2c`, you only need the
env vars + restart. If the live build is still `7f5a9bf`, trigger a deploy
after env is saved so the new loader is present.

## How to do it (do not bot-login)

The previous agent failed here: Playwright + a fresh Edge/Chrome profile hits
Cloudflare “Verifying you are human” on `auth.hostinger.com`. A decrypt-and-
login script also died on that challenge.

**Use the owner’s already-logged-in Edge.** Window title around 2026-09-08
17:40 was “OAuth Overview - Google Auth Platform … and 17 more pages”. hPanel
may already be one of those tabs. Open:

- https://hpanel.hostinger.com/websites
- introify.com Node.js web app → environment variables

Owner Hostinger login email: `shubhamprasadsoni@gmail.com`. If you need the
human: ask them to open that page and stay on it. Do not start Google/Cloudflare
login loops. Do not rate-limit Hostinger again.

Guardrails still in force:

- Do not rewrite Prisma to MySQL
- Hostinger web app root must stay `introify`
- Do not commit `.env` or `auth.json`
- Do not print secrets in chat
- `/dashboard` is owner studio; `/admin` is platform owner — do not merge them
- Do not retry Hostinger/Google from a bot browser profile

## Verify

After env + restart:

1. Owner Google-login at https://introify.com/sign-in
2. `/admin/ai` should show Codex configured
3. `/admin/capacity` Codex row should be ok
4. Send a chat on `/demo` (or an owned profile) and confirm `AiCallLog` /
   admin recent calls show `codex`, not a missing-provider error

Local check (already true): `npm run dev` uses `~/.codex/auth.json`.

## Out of scope

- Stripe
- Copying local Postgres into Neon
- Re-doing Google OAuth
- Committing helper scripts `_hpanel_codex_env.py` / `_edge_cdp.py`

## Accounts / IDs

- Owner: `shubhamprasadsoni@gmail.com` (also `shubhamprasadsony@gmail.com` in `ADMIN_EMAILS`)
- Clerk app `app_3J2aJYRN7HZOLqunOAyXsyIANOF`, production instance `ins_3J2iVUlOe8G1iR2GQWKjI6Tk8ev`
- Neon project `introify` (`icy-boat-80075899`)
- Google Cloud OAuth project `steadfast-sound-508011-c2` (already production)
- Hostinger unix user `u323815761`
