# Methodology and evidence boundary

The target repository, commit, tree, slice and license were committed before the baseline
ran. The upstream checkout stays ignored and is never vendored.

## How the frozen code is exercised

The frozen `adk_stale_agent/main.py` is executed **as `__main__`** in a child process, so its
own top-level handler decides the process status. Only external boundaries are replaced:

- issue discovery returns `[101, 202, 303]`;
- `InMemoryRunner` creates a synthetic session and raises on every run;
- API-call counters are fixed at zero;
- the ADK logging helper is a thin stand-in;
- for the separate sibling check, the issue-detail fetch raises once.

Nothing in the harness prints an exit status of its own. The recorded `STALE_MAIN_EXIT_CODE`
line carries the child process's real status: a harness that announced its own status would
be measuring itself, not the target.

This is `synthetic-orchestration` evidence. It establishes how the frozen Python control flow
accounts for deterministic boundary failures. It does not establish how often a real model,
GitHub API or production workflow fails.

## Oracles

Baseline (RED), all four required:

1. exactly three stale-agent ERROR records;
2. the literal `Successfully processed 3 issues.` record;
3. no failure list in the summary;
4. process exit status 0.

Patched (GREEN), all four required:

1. exactly three stale-agent ERROR records;
2. the literal `Successfully processed 0 issues.` record;
3. a `Failed to process 3 issues: [101, 202, 303]` record;
4. a non-zero process exit status.

No threshold or oracle was changed after observing a result. The patched oracle was written
from the remediation described in the upstream report, before the patch was applied.

## Patch handling

`npm run verify-fix` asserts the target is clean and at the frozen SHA, checks that the patch
applies, applies it, runs the patched oracle, then restores the file and re-asserts both the
clean tree and the frozen SHA. Restoration runs even when the assertions fail: a run that
could not restore the target reports failure rather than leaving a modified tree behind.

## Sanitization

Recorded output has the target checkout, this repository and the Python interpreter's own
directories replaced with `<target>`, `<repo>` and `<python>`. Interpreter paths matter
because on a pyenv or Homebrew install they sit under the reader's home directory; without
normalizing them, a correct run on someone else's machine would trip the local-path check.
That check is still enforced, and still fails the run when it fires.

## What is hashed

`evidence/hashes.json` pins the bytes of every recorded run, the duplicate-scan data, the
patch, and the frozen upstream file the patch was cut against. `npm run evidence:check`
re-derives all of them, and additionally requires that the hashed set and the tracked set
under `evidence/` and `patches/` agree in both directions — an artifact nobody hashed is
exactly the artifact a reader has no way to check.
