# KiroCrew Agent Write Paths

Updated: 2026-08-27 04:38 +05:30

Agents must not use the primary checkout for implementation work. The primary checkout is only for orchestration documents under `aiclone/docs/orchestration/**` and strategy documents under `aiclone/docs/strategy/**`.

| Lane | Branch | Writable project root |
| --- | --- | --- |
| core | `kirocrew/business-os-phase-1` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-wt\aiclone` |
| api | `kirocrew/business-os-api` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-api-wt\aiclone` |
| ui | `kirocrew/business-os-ui` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-ui-wt\aiclone` |
| quality | `kirocrew/business-os-quality` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-quality-wt\aiclone` |
| docs-verticals | `kirocrew/business-os-docs` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-docs-wt\aiclone` |
| integration | `kirocrew/business-os-integration` | `C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-integration-wt\aiclone` |

Before editing, each terminal must run:

```powershell
pwd
git branch --show-current
git status --short --branch
```

If the terminal says no write path is available, recover by `cd`-ing to the assigned writable project root above and repeating the checks. If the assigned path does not exist, stop and record the blocker in `docs/orchestration/INTEGRATION_QUEUE.md` rather than writing into the primary checkout.

Frozen paths remain patch-only until the restaurant owner hands them off: Prisma schema, restaurant/shop/order files, shared chat, surfaces, RAG, and nav-count wiring.
