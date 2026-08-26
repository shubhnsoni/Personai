# PersonaLink

AI-powered professional profile. Visitors chat with your clone, book calls, and buy from one link.

Marketing copy may say `personalink.com/{slug}` — that host is **brand fiction**. The real app URL until a domain is bought is [http://localhost:3000](http://localhost:3000). Repo/folder names stay `personai` / `aiclone`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 5 + PostgreSQL
- Clerk (auth)
- OpenAI (chat + embeddings)
- Stripe (Connect + Checkout)
- Resend (optional; console fallback if unset)
- Tailwind CSS 4 + Radix UI + Framer Motion

App lives in this `aiclone/` folder. Recovery notes: [`docs/HANDOFF.md`](docs/HANDOFF.md).

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

`npx prisma migrate dev` will fail until `prisma/migrations/migration_lock.toml` is switched from `sqlite` to `postgresql` (schema is already Postgres). The running app does not need a new migrate — tables already match.

Layout: `src/` app code, `prisma/` schema + seed + migrations, `scripts/one-off/` demo fillers, `docs/` handoff. User images go in `public/uploads/`.

## Environment (names only)

Set these in `.env`. Do not put real secrets in `.env.example` or the README.

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
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
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |

Leave `FROM_EMAIL` / `EMAIL_FROM` **unset**. Do not send real Resend mail in local/dev.

## Seed

`npx prisma db seed` (configured in `package.json`) upserts welcome-animation presets and the branded `/demo` profile (Riley Vale) so you can open [http://localhost:3000/demo](http://localhost:3000/demo). Marketing `/` links there.

## One-shot ADMIN bootstrap

`User.role` defaults to `CREATOR`. `syncUser()` never promotes anyone. There is no in-app “make admin” UI.

Sign in once so the Clerk user has a `User` row, then promote that known Clerk user id (`user_…` from the Clerk dashboard):

```bash
# from aiclone/, with DATABASE_URL in the environment
printf '%s\n' "UPDATE \"User\" SET role = 'ADMIN' WHERE \"clerkId\" = 'user_XXXX';" | npx prisma db execute --stdin
```

PowerShell:

```powershell
'UPDATE "User" SET role = ''ADMIN'' WHERE "clerkId" = ''user_XXXX'';' | npx prisma db execute --stdin
```

Replace `user_XXXX` with the real Clerk user id. Then open `/admin`.
