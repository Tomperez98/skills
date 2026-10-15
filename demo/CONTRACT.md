# Contract

A Linear-like tracker. Teams own numbered issues. Statuses: `backlog` (the
start), `todo`, `in_progress`, `done`, `canceled`.

- `CreateTeam(key)` — key must match `^[A-Z]{2,5}$` (400), and be new (409).
- `CreateIssue(team, title, priority)` — team exists (404), then title is
  non-blank and priority is 0–4 (400). The identifier is `<TEAM>-<n>`, where
  `n` counts up from 1 per team and is never reused, even after archiving.
- `SetStatus(id, status)` — issue exists (404), status is known (400), then
  a `done` or `canceled` issue accepts only `todo` (409), including a repeat
  of its own status.
- `Assign(id, assignee)` — issue exists (404); assignee is a non-empty name
  or `null` to unassign (400).
- `ArchiveIssue(id)` — issue exists (404); afterwards it is gone from
  `GetIssue` and `ListIssues`.
- `GetIssue(id)`, `ListIssues(team, status?)` — list is ordered by number,
  optionally filtered by status; unknown team 404, unknown status 400.
