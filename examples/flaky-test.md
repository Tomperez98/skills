# A flaky test

CI fails now and then on a test that always passes locally. `/diagnose`
routes it to ship CI, builds a loop that fails on demand, and pins the fix.

**You:** `/diagnose` — `test_export_report` fails in CI maybe one run in
ten. Never locally.

**Agent** _(diagnose)_:

**1. Name what is red.** "`test_export_report` fails about 1 in 10 CI runs,
never locally." That's CI-only and intermittent, so I'm following ship
CI.md first: every CI failure should be reproducible on a laptop (ship
skill, CI.md rule 5). From the last 30 runs: 3 failures, all on the 4-core
runners, all with `expected 3 rows, got 2`.

Done: symptom named, routed through ship CI.

**2. Build the loop.** One run at a time locally never fails. CI runs tests
in parallel, so I matched it:

```bash
for i in $(seq 50); do pytest -n 4 tests/test_export.py -q || break; done
```

```text
FAILED tests/test_export.py::test_export_report - expected 3 rows, got 2
(failed on iteration 7)
```

Done: red locally, about 1 in 8 runs.

**3. Shrink it.** I cut the other tests in the file one at a time. It still
fails with only `test_export_report` and `test_import_users` running in
parallel. Without `test_import_users`, it's 50 green runs in a row.

Done: two tests, and removing either one turns the loop green.

**4. Hypothesise, then probe.**

```text
1. Both tests write to the same temp dir `/tmp/export`
   → giving each its own `tmp_path` makes it pass
2. Both share one database and the import truncates a table
   → a separate DB per worker makes it pass
3. A clock-dependent query (rows "from today") crosses midnight
   → pinning the time changes nothing (ruled out by 1 or 2 passing)
```

Probing 1: `grep -rn /tmp/export` finds it hard-coded in `conftest.py`.
Switched both tests to `tmp_path` with a `[DEBUG-7c1e]` log of the path. 50
green runs in a row. Hypothesis 2: the DB is already per-worker, and
there's no truncate.

Done: hypothesis 1 survived; 2 was ruled out by its probe.

**5. Fix it and pin it** _(code: TEST)_. The fix moves the export dir into
config passed by value (code skill, TEST.md rule 7), so no test reaches a
shared path. I'm pinning it with the shrunk loop as a regression check: the
two tests run in parallel 20 times in one CI job. Without the fix that job
fails; with it, it's green. Removed the `[DEBUG-7c1e]` line.

Done: the regression check fails without the fix and passes with it, and
the 50-run loop is green.

**Agent:** The fix is ready to ship. Commit it on its own branch?
