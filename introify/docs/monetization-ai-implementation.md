# AI and presentation enforcement — implementation notes

Implemented 9 September 2026. This describes code behavior, not activation of production providers or paid checkout.

## Commercial AI path

- Published chat uses only explicit OpenAI/xAI API credentials and the server allowlist in `src/lib/ai-runtime.ts`. Personal Codex login, a stored raw model name and an admin profile-provider override cannot authorize published model spend.
- Configure `INTROIFY_AI_PROVIDER`, `INTROIFY_AI_FAST_MODEL`, `INTROIFY_AI_SMART_MODEL`, and `INTROIFY_AI_REASONING_MODEL`. Modes without an approved mapping/key are unavailable. `INTROIFY_AI_DISABLED=true` disables all modes. No automatic model/provider fallback occurs.
- `getAiAvailability()` exposes configured mode availability; public billing availability uses its Fast result. Placeholder keys do not count as configured.
- Catalog entitlement is checked before retrieval, conversation/message writes or vendor dispatch. Each public request supplies a unique `Idempotency-Key`; its profile-scoped hash is reserved once in the account ledger. Only a newly created RESERVED entry is a permit. Existing RESERVED, CONSUMED and RELEASED entries cannot dispatch again.
- Fast uses one AI credit, Smart 20 and Reasoning 40. UTF-8 serialized input limits conservatively fit 2,000 / 4,000 / 4,000 input-token recipes, including instructions, bounded history, local knowledge and the selected tool schema. Output bounds are 500 / 1,000 / 1,000 tokens. Latest visitor input is deliberately clipped to 550 UTF-8 bytes for this initial recipe; longer imports retain deterministic extraction, but model enrichment only sees a short excerpt.
- At most one local tool is offered and executed. Its result is returned directly, with no paid follow-up completion and no provider-hosted search tool. Invalid or unoffered tool calls do not execute.
- OpenAI uses `max_completion_tokens`. xAI uses a single non-streaming Responses call with `max_output_tokens`, `store:false`, and no hosted tools, adapted to the existing client stream. xAI's Chat Completions limit applies only to visible text; its Responses limit includes reasoning, which is why the adapter is necessary. Official reference: https://docs.x.ai/developers/rest-api-reference/inference/responses
- A delivered, persisted reply consumes the reservation with requested/returned model, provider, recipe, input/output/reasoning tokens when reported, and estimated token cost when explicitly configured. Optional `INTROIFY_AI_<MODE>_INPUT_USD_PER_MTOK` / `OUTPUT_USD_PER_MTOK` values enable cost estimates. Missing usage/rates are recorded as unknown, never zero-cost assumptions.
- Explicit pre-generation rejections release. A known empty completed reply or invalid structured import releases with its available receipt. Timeouts, partial streams and ambiguous persistence/settlement outcomes remain reserved for reconciliation. The client never automatically retries a provider request. A cancelled client stream continues the already-bounded upstream drain and settlement where the process remains alive; process death still needs reconciliation.
- Owner import enrichment shares the account allowance, one bounded Fast call with a stable content key. Local import extraction remains available if AI is unavailable. Query-time embeddings and unused automatic indexing are suspended; existing knowledge remains searchable locally, with no background provider charges. The admin-only diagnostic ping remains separate from published traffic.

## Memory privacy

Automatic memory requires both Pro+ and the owner's memory switch, plus affirmative visitor consent. The client explains that its next-message choice controls private notes; unchecking removes the conversation's notes on that next request.

Notes are short deterministic excerpts of visitor messages, with known names, emails and long phone numbers redacted. They use `VISITOR_MEMORY` / `CHAT_PRIVATE`, an opaque visitor or member identity, and the exact conversation ID. Retrieval requires both the verified identity and authorized conversation. An email alone is never a memory identity. No summarization or indexing provider runs in the background.

Legacy shared `PROFILE_MEMORY`, `CHAT_SUMMARY`, and new owner-exported `PRIVATE_CHAT_NOTES` documents are excluded from general public retrieval. Manual chat-note export remains private; it cannot teach one visitor's details to another visitor. Knowledge source/character limits cover memory writes transactionally. Redaction is defensive; isolation remains the privacy boundary because arbitrary personal information cannot be reliably redacted with patterns alone.

## Plan presentation

Free retains business name, photo and logo. Custom animation style/orb overrides and optional Introify footer removal require Starter+. Public renderers re-check entitlement, so a downgrade or unavailable billing configuration restores the default forest style and required footer. The footer occupies normal document flow, not an overlay on mobile chat.

Advanced analytics means the existing 30-day trends, traffic-source breakdown and conversion funnel. Their server queries and UI require Pro+. Basic activity, leads, bookings, revenue totals and unanswered-conversation counts remain available; this implementation does not provide separate Free 7-day charts or Starter source reports.

## Verification and limits

Mocked tests cover entitlement ordering, idempotency, bounded provider requests, tool limits, known/unknown failures, usage recording, imports, memory consent/isolation, direct settings writes, public styling after downgrade and analytics queries. Existing profile and KPI regressions are retained. No real provider calls or production database changes were used for these tests.

Remaining operational work includes provider account/model availability verification, live quality evaluation under these deliberately short recipes, completed-stream/process-death reconciliation, and commercial provider pricing configuration. These are not implied by an API-key presence check.
