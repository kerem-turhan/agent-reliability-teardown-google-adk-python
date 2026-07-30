# Third-party notices

## Google Agent Development Kit for Python

- Repository: <https://github.com/google/adk-python>
- Frozen commit: `20842eb8e035a6e128b7585ca81f4625e00147c2`
- Evaluated paths:
  - `contributing/samples/adk_team/adk_stale_agent`
  - `contributing/samples/adk_team/adk_issue_monitoring_agent/main.py`
- License: Apache License 2.0
- License at the frozen commit:
  <https://github.com/google/adk-python/blob/20842eb8e035a6e128b7585ca81f4625e00147c2/LICENSE>

The upstream source is not vendored. Verification checks it out into the
ignored `.work/` directory at the frozen commit.

## Modifications

`patches/adk_stale_agent-fail-closed.patch` is a modification of
`contributing/samples/adk_team/adk_stale_agent/main.py` from the repository
above, which is licensed under the Apache License 2.0. The patch is a
derivative work of that file and is offered under the same license, as section 4
of that license requires. It is applied only to the ignored working checkout,
for the duration of one verification run, and reversed afterwards. The upstream
project has neither reviewed nor accepted it.

This repository is licensed under the Apache License 2.0 (see `LICENSE`) so that
the patch and the frozen file it modifies carry the same terms.
