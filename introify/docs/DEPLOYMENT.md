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

- Google OAuth setup awaits the owner's approval to accept Google's API Services
  User Data Policy. Email sign-in is configured independently.
- AI provider and Stripe credentials were intentionally skipped at the owner's
  request. Configure and validate those integrations before relying on AI or
  payments in production.
- The new production database contains the deployment bootstrap data. Existing
  local development records have not been copied to Neon.

## Redeployment checks

After deploying the latest branch in Hostinger, verify the homepage, `/demo`,
`/sign-in`, `/api/health`, and a bundled upload. An unauthenticated request to
`/dashboard` must redirect to sign-in. Check Hostinger runtime logs if a page
returns an error. Database migrations and bootstrap output appear in build logs.
