# Watching main after merge

You're catching what the merge gate can't: slow-to-find bugs, performance
drift, and breakage in systems you don't control. Pre-merge CI is a
time-boxed sample. Main needs tests and measurements that keep running
after it. Apply the rules in order.

## 1. Keep long-running tests going after the merge

Fuzzers, simulators, and soak tests find more the longer they run, and CI
can only give them minutes. Run them continuously against main, and against
any release candidate, on dedicated machines. Report results per commit:
which seeds ran and which failed. Before a release, require no failures and
a healthy number of successful runs on recent commits.

## 2. Measure every merge to main

On each commit that lands on main, record the numbers users would notice:
build time, artifact size, throughput, tail latency, peak memory, on-disk
size, startup time, log volume, coverage. Benchmark the release build, not
a debug build, because the release build is what users run.

```
{"timestamp":1751500000,
 "attributes":{"git_commit":"47aeb22…","branch":"main"},
 "metrics":[{"name":"artifact size","unit":"bytes","value":8912345},
            {"name":"throughput","unit":"ops/s","value":1180000},
            {"name":"peak rss","unit":"bytes","value":2181038080}]}
```

## 3. Store metrics simply, append-only

You don't need a metrics database to start. Appending one JSON line per run
to a file in a separate git repo, with a static page that draws the graphs,
makes every data point versioned and diffable with nothing extra to run.
Handle concurrent writers with a bounded retry loop: fetch, reset, append,
commit, push, and try again on conflict. Put each token's regeneration
steps (scope, expiry, where it's stored) in a comment next to the code that
uses it, since it will expire.

## 4. A person reads the graphs before each release

A step change in memory, disk use, or artifact size might be a bug, or it
might be a deliberate trade-off. Either way someone should notice it before
users do. Make looking at the dashboard a step on the release checklist
(RELEASE.md), not something done when there's time.

## 5. Re-check what you don't control, on a schedule

Package registries, CDNs, base images, and language toolchains change under
you. Re-validate the latest release on a schedule, even when nothing in
your repo changed, so a registry that stopped serving your package shows up
before a user reports it. The validation itself is PUBLISH.md rule 8.

```yaml
on:
  schedule:
    - cron: 0 */6 * * *        # things you don't control drift
  workflow_run:
    workflows: ["Release"]      # and always right after a release
    types: [completed]
```

## 6. Every failure reaches a person, with a link

Send failures to a channel people watch, with a link to the run. Use one
alert job per workflow that depends on all the others and runs when any of
them failed. A red badge on a scheduled job that nobody opens tells no one.

```yaml
alert_failure:
  needs: [validate]
  if: ${{ always() && contains(needs.*.result, 'failure') }}
  steps:
    - run: ./scripts/notify "Release validation failed: ${RUN_URL}"
```

## 7. Every failure gets an owner

Make triage somebody's explicit job, whoever is shipping or on call. For
each untriaged failure or issue, do one of these: fix it now, close it with
a comment or a `triaged` label, or hand it to someone who can act on it. A
failure nobody owns will still be there next time.

---

MONITOR picks up where CI.md stops: it watches main and release candidates
over days rather than minutes, and makes sure someone looks. RELEASE.md
reads what it produces, and PUBLISH.md's validation runs on its schedule.
