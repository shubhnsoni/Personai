# Deployment verification — 9 September 2026

> Historical release evidence — 9 September 2026. These results describe the revisions and checks recorded below, not the current deployment. For later implementation and launch status, see [billing implementation](BILLING_IMPLEMENTATION.md) and [pending items](PENDING_ITEMS.md); current plan values are defined in the [billing catalog](../src/lib/billing/catalog.ts).

Recorded with live Edge results from **approximately 14:27 IST on 9 September 2026**.

**State as of 9 September 2026, 14:27 IST: `bba5220` deployment, public HTTP checks and scoped live Edge pricing/mobile/theme/navigation checks passed.** A slow live navigation bar, further accessibility/history cases, signed-out auth appearance and authenticated/provider operations were unverified at that check. The earlier migration recovery was resolved. Historical `026c2da` observations are explicitly separate. Hosting and Edge observations were relayed by the deployment operator; public route/asset results were verified directly over HTTP. Preparing this document did not access a database, hosting credentials or provider accounts.

## Revisions

| Revision | Change |
| --- | --- |
| `ceec052096c9406bd5b485720f17d987a57a638f` | Billing accounts, plans, usage credits and shared pricing. |
| `c15c8edcf74fbe20799b297d606a11913f3f58df` | Branded page transitions and launch checklist. |
| `026c2dacc7e6a250f71d0196f715c8b17a05ba34` | Earlier successful release: missing AR migration prerequisite and narrowly guarded recovery. |
| `bba5220b4259ea40bacd054d449f609df8f16543` | Release verified on 9 September 2026: expanded plan benefits/feature matrix and simpler loading/navigation feedback. Prices, quotas, entitlements, schema and provider flags unchanged. |

## Release verified on 9 September 2026 — `bba5220`

| Check | Result and limit |
| --- | --- |
| Targeted validation | **68 tests passed**: 38 navigation, 7 pricing, 23 billing/marketing/SEO, reported by the release operator. |
| Exact-commit local build | Isolated **Node 20.20.2** production build passed: **88s compilation**, **81s TypeScript**, **12/12 static pages**. Dummy service configuration; no provider readiness claim. |
| Hostinger deployment | Reported **Completed / Current on 9 September 2026 at 14:25 IST**, duration **3m53s**, full commit above. [Hostinger deployment record](https://hpanel.hostinger.com/websites/introify.com/deployments/01a0855d-7f05-7040-9c5d-c9f633050a86/details). |
| Hostinger build log | **No pending migrations**; bootstrap **0 new presets / demo existing**; Next.js compilation **68s**, TypeScript **30.2s**. No new migration was introduced by this release. |
| Visual acceptance on 9 September 2026 | Scoped live Edge checks passed around 14:27 IST: revised pricing cards, annual selection, responsive comparison, light/dark readability and fast navigation without the former overlay. Specific results and limits follow. |

Read-only HTTP checks completed at **14:26 IST** (`2026-09-09T08:56:46Z`):

| Route or asset | Verified response/evidence |
| --- | --- |
| `/`, `/pricing` | Both 200 and show “Remove the Introify footer”, “Conversion funnel overview” and “10 separate business workspaces”. Each has exactly five cards with unchanged monthly prices **$0/$10/$20/$40/$100**. Homepage still has `#plans` and `.billing-teaser`. |
| `/pricing` comparison | “Compare all features” summary and feature table present; business-type caveat, owner/pending-invitation seat wording and separate AI/3D balances present. HTTP verifies markup; disclosure interaction awaits Edge acceptance. |
| Allowances | All expected AI **50/500/1,500/4,000/10,000** and 3D **1 trial/3/10/20/50** strings present. |
| Availability | Paid checkout, AI and photoreal generation still display unavailable. No provider, purchase, email or real-login action was exercised. |
| `/demo`, `/sign-in`, `/sign-up`, `/privacy`, `/terms` | All 200 with expected titles. |
| `/api/health` | 200, `{"status":"ok"}`; public liveness only. |
| `/dashboard`, without login | 307 to `/sign-in`. |
| `/uploads/try-vase.jpg`, `/marketing/ceramic-vase.jpg` | Both 200, `image/jpeg`, **121,730 bytes** and valid JPEG magic. Confirms bundled public asset/upload delivery, not persistence of newly uploaded customer files across restarts. |
| `/_next/static/css/94ea149ac777b138.css` | 200; `.page-transit-progress`, `@keyframes introify-loading-line` and reduced-motion rules present. All seven homepage-linked stylesheets returned 200; old `.page-transit-wash`, `.page-transit-center`, `.brand-loading-orb` and `.brand-loading-wordmark` selectors absent from all seven. |

### Live Edge results — 9 September 2026, approximately 14:27 IST

| Check | Result and limit |
| --- | --- |
| Desktop pricing | Five expanded feature cards visually verified. |
| Annual selection | Paid monthly equivalents **$9/$18/$36/$90**, annual totals **$108/$216/$432/$1,080** verified. No checkout/purchase occurred. |
| Mobile feature comparison | Disclosure opened at **390×844**. Page scrollWidth **380** was below innerWidth **390**. The **790px** table stayed within an internally scrolling **337px** viewport; no page-wide overflow in this inspected state. |
| Themes/readability | Light and dark pricing/comparison screenshots were readable in the inspected views. |
| Actual header-home navigation | Home arrived quickly, with **no indicator flash**; old overlay/orb DOM count **0**. Arrival heading and expanded homepage benefits verified. |
| Slow-feedback limit | The delayed loading bar was **not captured during a slow live route**. Its compiled CSS and earlier preview evidence establish the intended 2px presentation, not a live slow-network observation. |
| Browser handoff | Original **Dark** theme restored, viewport reset. Deployed homepage tab **180574226** marked as the deliverable and left open. |

## Historical release evidence — `026c2da`

| Check | Result and limits |
| --- | --- |
| Recovery guard/orchestration validation | **105 tests passed**, as reported by the implementation owner. Covers exact incident recognition, partial-state refusals, connection/command boundaries and failure handling. Source: [`recover-billing-baseline.test.ts`](../tests/recover-billing-baseline.test.ts). |
| Real PostgreSQL migration rehearsals | **3 passed** on disposable databases: replay the full tracked chain without a pushed schema; preserve existing AR rows and Restrict foreign keys when foundation SQL is repeated; recover the first-statement missing-table incident while retaining existing business/product data and establishing billing ownership. Source: [`migration-chain.integration.test.ts`](../tests/migration-chain.integration.test.ts). |
| Earlier billing integration validation | **29 real PostgreSQL tests passed** for billing, Stripe reconciliation and AR quota/settlement behavior. These are disposable-database proofs, not live provider-account tests. |
| Navigation validation | **32 transition behavior tests and 35 existing auth/marketing/billing UI tests passed**; TypeScript, targeted ESLint and an isolated Node 20 production build passed before deployment. Live Edge later confirmed the visible transition and cleanup on arrival; broader acceptance limits are below. |
| Hostinger recovery, 13:10 IST | Build target `026c2da` ran the guard successfully: no billing schema changes from the failed attempt; exact failed billing record resolved. |
| Hostinger migrations, 13:10 IST | `20260909110000_ar_build_foundation` and `20260909120000_platform_billing` applied; the log reported all migrations applied successfully. |
| Hostinger bootstrap, 13:10 IST | Zero new presets; demo already existed. This does not establish authenticated access to every existing business resource. |
| Hostinger build/deployment, 9 September 2026, 13:13 IST | Reported **Completed / Current**, commit `026c2da`, duration **4m29s**, confirmed by the deployment operator. The host's expected WASM compiler fallback did not prevent deployment. |
| Live public frontend, 13:15 IST | All eight requested public routes returned 200, protected dashboard redirected to sign-in, and new pricing/homepage/transition asset markers were present. Details below. |

The original billing migration remains unchanged. The recovery only accepts the observed PostgreSQL `42P01` missing-`ArBuild` failure with the expected checksum, zero applied steps, required legacy tables and no billing structures/added columns. It uses Prisma's supported failed-record resolution, then the normal migration runner applies the additive prerequisite and billing migration. No database reset or deletion of business records was part of this recovery. See [`DEPLOYMENT.md`](DEPLOYMENT.md#missing-arbuild-migration-prerequisite).

## Historical HTTP baseline, before `026c2da`

Read-only requests at **12:55 IST**, before recovery/build completion:

| Route | Response |
| --- | --- |
| `/` | 200; previous homepage, AI roadmap wording and no new pricing teaser. |
| `/pricing` | 200; previous “Pricing & early access” title and “No paid Introify plans are currently offered.” |
| `/sign-in`, `/sign-up` | 200. |
| `/privacy`, `/terms` | 200. |
| `/api/health` | 200, `{"status":"ok"}`. Public liveness only; not database readiness evidence. |
| `/dashboard`, without login | 307 to `/sign-in`. |

## Historical HTTP verification — `026c2da`

Read-only checks completed at **13:15 IST** (`2026-09-09T07:45:10Z`):

| Route or asset | Verified response/evidence |
| --- | --- |
| `/` | 200; `#plans`, `.billing-teaser` and “A good beginning. A plan for what’s next.” present. Old AI-roadmap wording absent. |
| `/pricing` | 200; title “Plans & pricing — start free, grow your business”; heading “Start with your story. Grow from there.” Exactly five plan cards, with Free/Starter/Pro/Business/Scale and $0/$10/$20/$40/$100 monthly. |
| Pricing allowances | 50/500/1,500/4,000/10,000 monthly AI credit strings and 1 trial/3/10/20/50 3D generation strings present. Annual “Save 10%” control present; subsequent interactive annual-price verification is recorded below. |
| Service availability | Public pricing correctly displays paid checkout unavailable, AI unavailable and photoreal 3D unavailable. Old “No paid Introify plans are currently offered” wording absent. Catalog publication does not claim active provider services. |
| `/demo` | 200; “Riley Vale | Introify” title. |
| `/sign-in`, `/sign-up` | 200 with the expected Sign in / Create your account titles. Actual authentication was not attempted in this HTTP check. |
| `/privacy`, `/terms` | 200 with the expected policy titles. |
| `/api/health` | 200, `{"status":"ok"}`. Liveness only. |
| `/dashboard`, without login | 307 to `/sign-in`. |
| `/_next/static/css/b3d66348c70bd9b8.css` | 200; contains `.page-transit`, `.brand-loading`, `@keyframes introify-orbit` and reduced-motion rules. All seven homepage-linked stylesheets returned 200. |

## Historical Edge observations — `026c2da`

Recorded at **13:19 IST** from the deployment operator's completed checks on `026c2da`:

| Check | Observation and limit |
| --- | --- |
| Annual pricing interaction | Annual toggle showed Starter/Pro/Business/Scale monthly equivalents **$9/$18/$36/$90** and annual billed totals **$108/$216/$432/$1,080**. No checkout or purchase was made. |
| Actual navigation transition | Pricing's home link displayed the Introify orb/wordmark transition, which was captured and cleared after home arrived. This verifies that navigation and cleanup in the tested flow worked. |
| Mobile layout | At **390×844**, inspected homepage/pricing screenshots were readable with no overlap observed. DOM page scrollWidth was **380**, below innerWidth **390**; all five pricing titles aligned in one column. This is evidence for the inspected sections, not every route/viewport. |
| Themes | Light and dark pricing screenshots were visually checked. |
| Signup limitation | The existing authenticated Edge session redirected signup to admin. Signup form appearance was therefore **not verified**. No account mutations were made. |
| Browser handoff | System theme restored and viewport reset. Live homepage tab **180574216** was marked as the deliverable and left open. |

## Release acceptance and remaining operations as of 9 September 2026

- [x] Confirm successful Hostinger build/deployment and revised public frontend serving for `bba5220`.
- [x] Repeat the requested public-route/protected-route HTTP smoke checks, including `/demo`.
- [x] Confirm expanded tier benefits, full comparison markup, unchanged five plan prices/allowances and homepage teaser.
- [x] Confirm thin-line transition CSS delivery and absence of old navigation overlay/orb selectors.
- [x] Verify the selected bundled public upload and landing image are delivered successfully.
- [x] Recheck Annual selection, comparison disclosure and inspected responsive light/dark views on `bba5220`.
- [x] Verify fast header-home navigation has no indicator flash, reaches the correct content and contains no old overlay/orb DOM.
- [ ] Complete live keyboard-focus, reduced-motion, back/forward and deliberately slow-route checks; no slow live loading-bar capture is claimed.
- [ ] Visually verify sign-in/sign-up in a signed-out session; the authenticated signup redirect prevented signup form inspection.
- [ ] Verify authenticated access to existing profiles, collaborators, offerings, uploads and dashboard/Billing. Preserve existing business data and permissions.
- [ ] Verify persistent files and durable worker behavior in the deployed runtime without duplicate payment or generation effects.
- [ ] Complete provider activation and real provider-account tests before claiming paid checkout, advertised AI modes or photoreal generation work. Provider flags, funding, keys, approved public operator/policy values and operational ownership remain pending; deployment success alone does not enable them.
- [ ] Review a fresh Hostinger vulnerability scan for the serving revision.

Public legal/contact values remain intentionally blank at the owner's request. Keep checkout and unavailable services clearly gated. Existing merchant payments/Connect, email delivery and future SMS adapters require their own verification. The complete owner/operations list remains in [`PENDING_ITEMS.md`](PENDING_ITEMS.md).
