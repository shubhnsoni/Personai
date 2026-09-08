# Introify

AI-powered professional profile. Visitors chat with your clone, book calls, and buy from one link.

Live domain: [introify.com](https://introify.com). Locally: [http://localhost:3000](http://localhost:3000). App folder: `introify/`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 5 + PostgreSQL
- Clerk (auth)
- OpenAI (chat + embeddings)
- Stripe (Connect + Checkout)
- Resend (optional; console fallback if unset)
- Tailwind CSS 4 + Radix UI + Framer Motion

App lives in this `introify/` folder. Recovery notes: [`docs/HANDOFF.md`](docs/HANDOFF.md).

## Scripts

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint
npx prisma migrate dev
npx prisma db seed
```

## Setup

1. Copy `.env.example` to `.env` and fill the named vars. **Never commit `.env`.**
2. `npm install`
3. `npx prisma migrate dev`
4. `npx prisma db seed`
5. `npm run dev` → [http://localhost:3000](http://localhost:3000)

Schema and `migration_lock.toml` are PostgreSQL. Hostinger shared MySQL is not a database for this app — use Neon/Supabase Postgres.

For Hostinger Node.js, select this `introify/` directory, Node 20, build command
`npm run build:hostinger`, and start command `npm start`. The build applies tracked
PostgreSQL migrations using the host's `DATABASE_URL`, creates missing welcome
presets and the `/demo` profile, then builds Next.js. This bootstrap preserves
existing records and skips an existing demo. Set the production Clerk keys and
`NEXT_PUBLIC_APP_URL=https://introify.com` in Hostinger before building.
Hostinger uses the native `.mjs` configuration and Webpack so Next.js can fall
back to its WASM compiler when the host's older glibc cannot load native SWC.

Set `UPLOADS_DIR` to a writable, persistent directory outside Hostinger's
deployment tree, such as `/home/<username>/domains/introify.com/uploads`.
Uploads and generated QR/AR assets are written there while their public URLs stay
`/uploads/...`. Reads prefer this directory and fall back to committed demo assets
in `public/uploads/`. When unset, local development uses `public/uploads/` for both
reads and writes. Relative values resolve against the app's working directory;
use an absolute path on Hostinger so redeployments keep the same storage.

Layout: `src/` app code, `prisma/` schema + seed + migrations, `scripts/one-off/` demo fillers, `docs/` handoff. User images go in `UPLOADS_DIR`, or `public/uploads/` when unset.

## Environment (names only)

Set these in `.env`. Do not put real secrets in `.env.example` or the README.

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `UPLOADS_DIR` | Persistent upload directory; defaults to `public/uploads` locally |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |
| `OPENAI_API_KEY` | Chat + embeddings |
| `STRIPE_SECRET_KEY` | Required for any payment path |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required with the secret |
| `STRIPE_WEBHOOK_SECRET` | Required to verify webhooks |
| `RESEND_API_KEY` | Optional. Unset → mail logs to the console |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; `https://introify.com` in production |
| `ADMIN_EMAILS` | Comma-separated. Those emails become `User.role=ADMIN` on sign-in and can open `/admin` |
| `XAI_API_KEY` | Optional Grok fallback when Codex is off or missing |

Leave `FROM_EMAIL` / `EMAIL_FROM` **unset**. Do not send real Resend mail in local/dev.

## Seed

`npx prisma db seed` (configured in `package.json`) upserts welcome-animation presets and the branded `/demo` profile (Riley Vale) so you can open [http://localhost:3000/demo](http://localhost:3000/demo). Marketing `/` links there.

## Platform owner (`/admin`)

Shop owners stay on `/dashboard`. You live on `/admin`.

Set `ADMIN_EMAILS=you@example.com` in `.env` (comma-separated). `syncUser()` promotes those emails to `User.role=ADMIN` on the next sign-in. `/admin/users` can promote or demote others; it cannot demote an `ADMIN_EMAILS` address.

Admins with no shop go to `/admin`. Create a shop with `/onboarding?shop=1`.
