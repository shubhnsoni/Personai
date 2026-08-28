# Lane E health endpoint and HTTP regressions

## Health contract

`GET /api/health` is a public liveness endpoint. Its complete JSON response is:

```json
{"status":"ok"}
```

The public path does not probe dependencies and does not disclose timestamps, provider names, connection failures, connection strings, or key/configuration state.

Detailed diagnostics require both `?details=1` and a constant-time match of the `x-health-diagnostics-token` request header against `HEALTH_DIAGNOSTICS_TOKEN`. Missing, malformed, or incorrect authorization fails closed to the same public liveness response; it does not return diagnostic data or an authorization clue.

An authorized detailed response contains only `status` and the categorical `database` value (`ok` or `unavailable`). Database exceptions are intentionally discarded. No provider configuration is evaluated or reported.

## Executable regression coverage

Run the HTTP boundary suite from the repository root:

```powershell
npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/one-off/check-auth-http-regressions.ts
```

The suite first proves the configured database target is disposable with `assertDisposableTarget`, then runs a loopback-only temporary HTTP server. It exercises the public and restricted health responses, the actual middleware module using deterministic Clerk doubles, and the existing deterministic Business OS authorization boundary. It always closes the listener and verifies that the selected loopback port is no longer reachable.

Set `INVERT_ASSERTION=1` to prove the suite fails when its central success assertion is inverted. No authorization parameter is placed alongside `unauthenticatedUrl` in this suite because the current middleware call does not use one. If a future test combines them, it must independently prove the authorization parameter remains enforced under the installed patched Clerk version.

A real authenticated browser session is not required and is not claimed by this coverage; authenticated Business OS cases use the repository's deterministic server-boundary doubles.
