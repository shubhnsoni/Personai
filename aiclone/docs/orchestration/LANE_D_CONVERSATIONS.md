# Lane D — Conversation Ownership

TASK: Remediate conversation ownership and preserve verified public persona chat.
REQUESTED_MODEL: gpt-5.6-sol
OBSERVED_MODEL: gpt-5.6-sol
BRANCH: security/lane-d-conversations
WORKTREE: C:\Users\shubh\Desktop\Projects\personal projects\personai-lane-d-conversations-wt\aiclone
COMMIT_SHA: this commit (exact SHA is recorded in the external orchestration report)

ROUTES_REMEDIATED:
- `src/app/api/chat/route.ts`
- `src/app/api/live/route.ts`

MEMBER_BINDING: Existing chat conversations require both the server-resolved member ID and claimed profile ID. New member conversations persist the server-resolved member ID. The live route resolves the member server-side, reads by conversation ID plus member ID, and scopes writes by conversation ID, profile ID, and member ID.

VISITOR_CAPABILITY: Versioned base64url JSON payload `{v,c,p,i,e}` binds capability version, conversation ID, profile ID, visitor ID, and expiry. The payload is signed with HMAC-SHA-256 using a SHA-256-derived key over the fixed context `personai:conversation-capability:v1`, a NUL separator, and a server-only secret. Verification uses constant-time signature comparison, exact binding checks, and strict future expiry. Default TTL is 24 hours. The capability is returned in a profile-scoped, HttpOnly, SameSite=Lax `/api` cookie; production cookies are Secure.

PROFILE_TENANT_BINDING: Every existing-conversation lookup requires the claimed profile ID. A capability issued for profile A fails against profile B because the profile ID is signed and the database lookup is profile-scoped.

CROSS_MEMBER_PREVENTION: Member reads and writes require the server-resolved member ID. `updateMany` predicates repeat conversation, profile, and member ownership so a stale or forged request cannot mutate another member's conversation.

PUBLIC_CHAT_PRESERVED: A public profile can still create an anonymous conversation. The route issues the visitor capability and stable visitor cookie, and a second request can continue that conversation only with both values. The route-level harness proves create and continue success with two persisted messages per successful turn.

ZERO_LEAKAGE_EVIDENCE: Anonymous foreign-ID, wrong-member, cross-profile, forged-capability, expired-capability, and live wrong-member paths return the same non-enumerating 403 refusal. The harness asserts the private history marker is absent.

NO_EFFECT_ON_REFUSAL_EVIDENCE: Before/after snapshots compare conversations, messages, and profile events on every refusal path. Provider and retrieval counters also remain unchanged on refused chat requests.

RAG_TOUCHED: no
PATHS_OUTSIDE_OWNERSHIP_TOUCHED: none (the pre-existing `scripts/tsconfig.checks.json` change was supplied by root and was not edited or included)
PRISMA_TOUCHED: no
MANIFEST_TOUCHED: no
DB_ACCESS: `assertDisposableTarget` runs before access and requires exactly `personalink_phase0_rehearsal_20260826_210704`; all fixture writes run in one interactive transaction and end with deterministic rollback; post-rollback fixture absence is asserted.
EXTERNAL_PROVIDER_CALLED: no, stubbed. LLM completion and retrieval are injected stubs; refusal paths assert neither stub was called.

GATE_EXIT_CODES:
- `npx prisma validate`: 0
- `npx tsc --noEmit --pretty false`: 0
- targeted `npx eslint`: 0
- `check-conversation-authz` normal: 0
- `check-conversation-authz` inverted: 1 (expected non-zero)
- `check-conversation-authz` restored: 0
- `check-auth-authz`: 0
- `check-tenant-isolation`: 0
- `check-ownership-foundation`: 0
- `check-foundation-contracts`: 0
- `check-copilot-runtime`: 0
- `npm run build`: 0
- `check-schema-invariants`: skipped as directed

INVERSION_CONTROL: `INVERT_ASSERTION=1` inverted the central anonymous-foreign-conversation assertion and exited 1; removing the variable restored a full pass and exit 0.
SECRETS_PRINTED: none
BLOCKERS: none
