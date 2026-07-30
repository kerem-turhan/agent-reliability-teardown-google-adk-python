# System model

At the frozen commit, `.github/workflows/issue-maintenance.yml` schedules the
maintenance workflow every day at 06:00 UTC and grants `issues: write`. The
`audit-stale` job runs `python -m adk_stale_agent.main`.

Within `adk_stale_agent/main.py`:

1. `get_old_open_issue_numbers` selects candidates.
2. A task calls `process_single_issue` for each candidate.
3. Each task creates an `InMemoryRunner` and consumes `run_async`.
4. A broad `except Exception` logs the error but returns normal duration/API
   metrics.
5. The batch increments `processed_count` by `len(chunk)`.
6. The final log says every counted item was successfully processed.
7. The `__main__` handler logs any fatal error and lets the process end normally, so the
   status the scheduled workflow sees is 0 either way.

Steps 4 through 7 form the path this teardown reports: the failure is visible in the log
line by line, and invisible in every summary a scheduler or a human skimming a green run
would look at. The patch in `patches/` changes 4, 5, 6 and 7 and nothing else.

`main()` has one further early return, when the initial issue-list fetch raises. That path is
adjacent to the reported one and is deliberately left unpatched here, so the patch matches
what was described upstream.

The sibling `adk_issue_monitoring_agent/main.py` uses the same broad
catch-and-return shape in its per-issue function. This does not prove the same
user-visible summary there; it shows the exception-swallowing shape is shared
by two adjacent maintenance agents.
