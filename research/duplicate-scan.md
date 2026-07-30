# Duplicate and prior-notification scan

Refreshed on 2026-07-30, before any upstream report was filed. All 27 searches
used GitHub's official Search API over `google/adk-python` issue and pull
request titles/bodies:

```bash
gh api -X GET search/issues \
  -f q='repo:google/adk-python <term> in:title,body' \
  -f per_page=100
```

| # | Search term | Gross hits |
|---:|---|---:|
| 1 | `adk_stale_agent` | 4 |
| 2 | `"Successfully processed"` | 9 |
| 3 | `processed_count` | 0 |
| 4 | `get_old_open_issue_numbers` | 1 |
| 5 | `"Error processing issue"` | 0 |
| 6 | `adk_issue_monitoring_agent` | 3 |
| 7 | `issue-maintenance.yml` | 0 |
| 8 | `"issue maintenance"` | 3 |
| 9 | `"stale agent"` | 14 |
| 10 | `stale_agent` | 0 |
| 11 | `close_as_stale` | 0 |
| 12 | `InMemoryRunner` | 55 |
| 13 | `"processed issues"` | 0 |
| 14 | `"silent failure"` | 27 |
| 15 | `"fail open"` | 12 |
| 16 | `"false success"` | 7 |
| 17 | `"exit 0"` | 20 |
| 18 | `"workflow green"` | 0 |
| 19 | `"successfully processed"` | 9 |
| 20 | `"errors are swallowed"` | 0 |
| 21 | `"swallow exception"` | 10 |
| 22 | `"exception handling"` | 66 |
| 23 | `"continue on error"` | 2 |
| 24 | `"partial failure"` | 4 |
| 25 | `"stale issue automation"` | 0 |
| 26 | `"issue monitoring agent"` | 10 |
| 27 | `"issue processing"` | 11 |

The 267 gross hits are not 267 candidates: broad terms such as
`InMemoryRunner` and `exception handling` intentionally over-collect.
Manual review of exact-path and behavior-adjacent hits found:

- #5696 / PR #5697: different triaging workflows failed visibly on a model
  404; they do not describe a caught per-item error being counted as success.
- PR #3700: stale-agent API/quota optimization; it introduced the current
  chunk counter but does not track per-item success.
- PRs #3546, #3938, and #4041: creation and stale-classification fixes, not
  batch outcome accounting.
- PR #4622: creation of the sibling monitoring agent.

Conclusion: no issue or pull request in the refreshed result set reports the
combination demonstrated here: per-issue exceptions, an all-success summary,
and exit 0. The raw normalized hit metadata is preserved in
`evidence/duplicate-scan-2026-07-30.json`.
