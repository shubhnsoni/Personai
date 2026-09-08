# Lane B: uploads and external compute

## Security boundary

Both `POST /api/upload` and `POST /api/image-to-3d` call the frozen ownership foundation before reading a request body, writing a file, recording usage, or invoking external compute. Identity comes from `requireOwnedProfile`; an optional `x-profile-id` claim is accepted only as an ownership claim and must match a profile returned by the server-derived identity source. Anonymous callers receive the standard 401 envelope and authenticated foreign-profile callers receive the standard 403 envelope.

Artifacts are stored below `public/uploads/<owner-hash>/`. The owner directory is a SHA-256-derived, filesystem-safe value computed from the server-owned profile id. Filenames contain only a server-generated UUID (or a one-way hash fallback) and a byte-validated canonical extension. Original caller filenames never become path segments. Every successful artifact is recorded as a profile-owned `ProfileEvent`; if that ownership record fails, the newly written file is removed.

## Limits and validation

- General upload file limit: 50 MiB.
- General multipart request limit: 51 MiB, including multipart overhead.
- Image-to-3D decoded image limit: 10 MiB.
- Image-to-3D JSON body limit: 14 MiB.
- Generated GLB limit: 50 MiB.

Bodies are consumed through a bounded stream reader. A declared oversized `Content-Length` is refused before any body read; streamed bytes are also counted so a missing or false length cannot bypass the cap. Multipart and JSON parsing happen only after the bounded read completes. File size is checked before `File.arrayBuffer()`.

The upload allow-list requires agreement between all three signals: declared media type, extension, and detected bytes. Detection checks JPEG, PNG, WebP, GIF, PDF, MP4, WebM, MP3, WAV, GLB 2.0, glTF 2.0 JSON, and USDZ/ZIP signatures. `application/octet-stream` is explicitly rejected. Image-to-3D accepts only strict base64 JPEG, PNG, or WebP data URLs whose decoded magic bytes match the declared image media type. Provider output must be a bounded GLB 2.0 before it can be written.

## Durable usage control

`src/lib/rate-limit.ts` is not used because its process-local `Map` is lost on restart and is inconsistent across instances. Both routes instead use the existing `ProfileEvent` table as a durable usage ledger. A PostgreSQL transaction-scoped advisory lock serializes each profile/operation/time-bucket, then one serializable transaction counts the bucket and records the consumed slot. Upload allows 20 requests per profile per minute; image-to-3D allows 3 paid-compute requests per profile per hour. If the database transaction or durable ledger is unavailable, the route returns a generic 503 and fails closed.

Rejected requests can consume a usage slot after authentication, but cannot write artifacts or invoke paid compute. This intentionally prevents authenticated malformed-request floods from bypassing accounting.

## Error behavior and verification

Ownership refusals use the shared stable security envelope. Validation, quota, provider, persistence, and configuration failures return fixed generic messages. Provider text, stack traces, filesystem paths, database URLs, and key/configuration state are never returned.

`scripts/one-off/check-upload-security.ts` invokes the actual route factories with the real ownership foundation and controlled dependencies. It verifies anonymous and foreign-profile refusal, valid-owner success, bounded requests, byte-signature mismatches, octet-stream refusal, traversal resistance, no write/compute on refusal, generic errors, fail-closed quota behavior, and retained GLB/USDZ/image-to-3D AR success. External compute and persistence are stubbed; the check performs no database writes and never calls a paid provider.
