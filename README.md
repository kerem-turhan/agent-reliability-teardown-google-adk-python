# Agent reliability teardown: Google ADK stale-issue automation

A scheduled maintenance agent in `google/adk-python` logs an error for every issue it failed
to audit, then reports `Successfully processed 3 issues.` and exits 0. This is the harness
that catches it, and a one-file patch that makes the same run fail closed.

```bash
npm ci
npm run verify
```

No model API key, no paid API, no database. The behavior itself is network-free; the only
network access is the initial clone of the frozen target.

```text
baseline   3 injected failures   ->  "Successfully processed 3 issues."   exit 0
patched    3 injected failures   ->  "Successfully processed 0 issues."   exit 1
                                     "Failed to process 3 issues: [101, 202, 303]"
```

The exit status above is the status of the child process that ran the frozen
`adk_stale_agent/main.py` as `__main__`. The harness records that number; it never prints a
status of its own.

The target is [`google/adk-python`](https://github.com/google/adk-python), frozen at commit
`20842eb8e035a6e128b7585ca81f4625e00147c2` (Apache-2.0). At that commit,
`.github/workflows/issue-maintenance.yml` runs this module daily with `issues: write`.

## Upstream status

Reported upstream first: [google/adk-python#6520](https://github.com/google/adk-python/issues/6520),
filed before this repository was published. A project collaborator reproduced the behavior using
the report's steps. On 12 August 2026, upstream commit
[`5418b731`](https://github.com/google/adk-python/commit/5418b731564743aa7b981fd77741fb1cb5242faa)
landed on `main` and closed the issue with separate tests and a fail-closed process exit. The earlier
fix pull request [#6521](https://github.com/google/adk-python/pull/6521) remains open and unmerged,
so it is not the landed path. As of 13 August, the latest stable release (`v2.6.3`) predates the fix;
release-candidate PR [#6700](https://github.com/google/adk-python/pull/6700) targets `v2.7.0`.
The patch in this repository was not submitted as a pull request.

## Evidence boundary

Every result here is labeled `synthetic-orchestration`: the frozen upstream control flow
runs, while issue discovery and the agent runner are deterministic fakes. This measures how
that control flow accounts for a failed step. It says nothing about model quality,
production frequency, security impact, or the ADK package as a whole, and it does not claim
a real scheduled run has hit this path.

The patch is applied to the ignored working checkout for one verification run and reversed
afterwards. It is not vendored. For where the upstream report stands, see
[Upstream status](#upstream-status).

## What the patch changes

One file, `contributing/samples/adk_team/adk_stale_agent/main.py`, along the lines proposed
in the upstream report:

1. each per-issue result carries whether the audit ran without raising;
2. the batch counts only successes and lists failures separately;
3. the run raises once every issue has been attempted, so per-issue isolation is kept;
4. the top-level handler reports that outcome in the process exit status.

## Reproduce

Prerequisites: Git, Python 3.11+, Node.js 22+, and npm. No API key, database or private data
is required.

| Command | Purpose |
|---|---|
| `npm run target:checkout` | Clone the target into ignored `.work/` and check out the frozen SHA |
| `npm run repro:offline` | Baseline run: three injected failures, all-success summary, exit 0 |
| `npm run verify-fix` | Apply the patch, prove the patched run fails closed, reverse the patch |
| `npm run evidence:check` | Re-hash the recorded evidence and re-check its markers |
| `npm run scan:release:test` | Tamper probes for the release guard: break it on purpose, require red |
| `npm run scan:release` | Release guard over every tracked file and the whole Git history |
| `npm run verify` | The complete gate, in that order |

Every command after `target:checkout` assumes the frozen target is present and fails loudly
if it is not.

## Evidence map

- Freeze: [`research/target-freeze.json`](research/target-freeze.json)
- Duplicate scan (27 queries): [`research/duplicate-scan.md`](research/duplicate-scan.md)
- RED → GREEN summary: [`evidence/red-green-summary.md`](evidence/red-green-summary.md)
- Raw runs: [`evidence/baseline-output.txt`](evidence/baseline-output.txt) ·
  [`evidence/patched-output.txt`](evidence/patched-output.txt)
- Byte pins: [`evidence/hashes.json`](evidence/hashes.json)
- Patch: [`patches/adk_stale_agent-fail-closed.patch`](patches/adk_stale_agent-fail-closed.patch)
- Methodology: [`docs/methodology.md`](docs/methodology.md)
- System model: [`docs/system-model.md`](docs/system-model.md)
- Claim index: [`CLAIMS.md`](CLAIMS.md)

## Second vendor, same class

The same failure class — a failed step counted as a finished one — was found first in an
official `openai/openai-agents-js` example and reported as
[openai/openai-agents-js#1544](https://github.com/openai/openai-agents-js/issues/1544). That
teardown, with its own six-case harness, is at
[agent-reliability-teardown-openai-agents-js](https://github.com/kerem-turhan/agent-reliability-teardown-openai-agents-js).
Two vendors, two frozen commits, the same accounting mistake.

The pattern itself, with a checklist for probing your own agent for it, is written up there:
[docs/FIELD-GUIDE.md](https://github.com/kerem-turhan/agent-reliability-teardown-openai-agents-js/blob/main/docs/FIELD-GUIDE.md).

## License and attribution

This harness and patch are Apache-2.0 licensed, matching the evaluated target, which remains
copyright Google LLC. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Next step

Want the same failure-focused teardown for your own agent? Start here: https://kerem-turhan.github.io/roadto100k-site/
