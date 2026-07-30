# RED → GREEN summary

Both runs execute the frozen `adk_stale_agent/main.py` as `__main__` in a child process
with deterministic fake boundaries. The exit status below is that child process's status,
not a value the harness prints for itself.

| | Baseline (RED) | Patched (GREEN) |
|---|---|---|
| Injected issues | 3 | 3 |
| Injected runner failures | 3 | 3 |
| Reported successful count | **3** | **0** |
| Failed issues listed | no | `[101, 202, 303]` |
| Process exit status | **0** | **1** |
| Raw output | [`baseline-output.txt`](baseline-output.txt) | [`patched-output.txt`](patched-output.txt) |

The patch under test is [`patches/adk_stale_agent-fail-closed.patch`](../patches/adk_stale_agent-fail-closed.patch).
It is applied to the frozen checkout for the patched run only and reversed afterwards; the
target tree is asserted clean and at the frozen SHA before and after.

## Reproduce

```bash
npm run target:checkout
npm run repro:offline      # baseline (RED)
npm run verify-fix         # apply patch, patched run (GREEN), reverse patch
```

## Run environment

- Run date: 2026-07-30
- Target: `google/adk-python@20842eb8e035a6e128b7585ca81f4625e00147c2`
- Evidence class: `synthetic-orchestration`
- Network during the behavior repro: no
- Secret or API key: no
- Recorded on: macOS 26.5.2, Python 3.13.5, Node.js 24.13.0

The recorded outputs are byte-pinned in [`hashes.json`](hashes.json), which also pins the
frozen upstream file the patch was cut against. Interpreter-internal paths in tracebacks are
normalized to `<python>`, the target checkout to `<target>` and this repository to `<repo>`,
so the recorded text carries no local absolute path.

## Not shown by these runs

- The sibling `adk_issue_monitoring_agent` observation is a per-issue return-shape check
  only. The patch does not touch that file and no claim is made about its batch outcome.
- `main()` also returns early when the initial issue-list fetch raises. That path is
  adjacent to the one reported and is deliberately left outside this single-file patch,
  which stays scoped to what was reported upstream.
- Nothing here measures model quality, production frequency, or security impact.
