# Watching main

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Run suites too slow for PRs (version matrix, soak, property, concurrency, end-to-end) on main and report per commit or commit range. Bisect a failing range to one commit. Releasing a commit requires these to be green.
- Record the numbers users would feel (build time, artifact size, latency, memory) on every merge, from the shipped build. Watch the trend. A person decides whether a jump is a regression or a trade-off.
- Re-run release validation on a schedule: registries, base images, external APIs, and toolchains change without your repo changing.
- Page on symptoms users feel (error rate, a latency percentile, queue age), not on causes. Every alert is actionable, takes its threshold and duration from the objective, and links to a runbook. Use two severities: page (act now) and ticket (next working day). Test-fire each new alert once.
- Every failure reaches a person. Keep one tracking issue per failing job: the first failure opens it, later failures comment on it, and the first green run closes it.
