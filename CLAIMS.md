# Claim-to-evidence index

Every row is pinned to a file in this repository and a command that re-derives it. If a
command cannot check what its row claims, it exits non-zero rather than printing a pass.

| Claim | Evidence | Reproduction |
|---|---|---|
| The target was frozen before any result was produced, at `20842eb8…`, Apache-2.0. | `research/target-freeze.json`; freeze commit `2aac14c` in this repository's history | `npm run evidence:check` |
| Baseline: three injected runner failures are logged, the batch reports `Successfully processed 3 issues.`, and the frozen entry point exits 0. | `evidence/baseline-output.txt` | `npm run repro:offline` |
| Patched: the same three failures produce `Successfully processed 0 issues.`, a `Failed to process 3 issues: [101, 202, 303]` record, and a non-zero exit status. | `evidence/patched-output.txt`; `patches/adk_stale_agent-fail-closed.patch` | `npm run verify-fix` |
| The patch applies cleanly to the frozen file, and the target checkout is clean and back at the frozen SHA after the run. | `scripts/verify-fix.mjs` assertions | `npm run verify-fix` |
| The recorded evidence has not drifted, and the frozen file the patch was cut against is the one checked out. | `evidence/hashes.json` | `npm run evidence:check` |
| The sibling issue-monitoring file catches a per-issue exception and still returns its normal metrics tuple. | `evidence/baseline-output.txt` (`SIBLING_RETURNED_AFTER_ERROR=true`) | `npm run repro:offline` |
| The stale job is scheduled daily with `issues: write`. | Frozen `.github/workflows/issue-maintenance.yml` lines 17–20 and 38–40 | `npm run target:checkout && sed -n '17,40p' .work/upstream/.github/workflows/issue-maintenance.yml` |
| A 27-query scan found related maintenance work but no prior title/body report of this false-success combination. | `research/duplicate-scan.md`; `evidence/duplicate-scan-2026-07-30.json` | Commands in `research/duplicate-scan.md` |
| The behavior was reported upstream before this repository was published. | [google/adk-python#6520](https://github.com/google/adk-python/issues/6520) | Open the issue |
| The release guard detects its own breakage rather than passing over it. | `scripts/test-scan-release.mjs`, 13 tamper probes | `npm run scan:release:test` |

## Claims this repository does not make

- Nothing here measures model quality, financial or triage correctness, security impact, or
  how often a real scheduled run hits this path.
- The sibling observation is a per-issue return-shape check only; the patch does not touch
  that file and its batch outcome was not measured.
- `main()` also returns early when the initial issue-list fetch raises. That adjacent path
  is left outside this patch, which stays scoped to what was reported upstream.
- The upstream project has neither reviewed nor accepted the patch.
