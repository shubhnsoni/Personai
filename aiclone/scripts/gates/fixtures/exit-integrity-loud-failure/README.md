# exit-integrity-loud-failure fixtures

Adversarial inputs for `scripts/one-off/check-harness-exit-integrity.ts` covering the second half of
the contract: the scanner must never silently give up or silently truncate. If it cannot resolve
something, it has to say so and fail visibly.

| fixture | the thing it cannot resolve | required visible behaviour |
| --- | --- | --- |
| `starved-resolution.ts.txt` | a three-link wrapper chain, resolved with the step budget deliberately starved to 1 | the worklist reports resolution INCOMPLETE and names the reason; the harness escalates it to the gating `HELPER_RESOLUTION_INCOMPLETE` and exits non-zero. Run with the real budget the same file resolves fully and yields `REAL_DEFECT`. |
| `value-mediated-helper.ts.txt` | a real helper reached only through an array index and a computed string key — `NOT_FOLLOWED` item (1) | zero recognised assertion calls, escalated to the gating `NO_ASSERTION_RECOGNISED`; the harness must not print a green `FINAL_VERDICT` for a file it could not judge |

The distinction matters. `starved-resolution` proves the alarm behind a *provably unreachable*
defence-in-depth budget is actually wired — an unreachable guard whose handler was never executed is
indistinguishable from no guard. `value-mediated-helper` proves the scanner's *declared, reachable*
blind spot is also loud: silence about a file is reported as "not judged", never as "judged clean".

See `../exit-integrity-convergence/README.md` for why these files use the `.ts.txt` extension.
