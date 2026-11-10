# Deploys (running services)

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- A deploy replaces running code; a release publishes an artifact. Published versions stay immutable. A deploy may roll back, but only to N-1 inside the window the rollout rules enforce, and a rollback never re-tags or republishes.
- Write the rollback plan before deploying: what triggers it, the exact command, how long it takes, and what happens to data N wrote. Rehearse it in staging; a rollback that has never run is a guess.
- Ship risky behavior behind a flag that defaults off and is read through config like any other value. Each flag has an owner and a removal date. Delete the flag and the dead path once it has been at 100% for a full release.
- CI runs the tests with each flag both on and off. Don't nest flags.
- Roll out in steps. Send a canary a small share of traffic and compare it against the baseline on the same metrics. Write the advance, hold, and roll-back thresholds (error rate, a latency percentile, new error types) before starting.
- After each step, verify from outside: the health endpoint, error rate, latency, no new error types, and the critical user flow end to end.
- Start a deploy only when someone can watch it for the first hour.
- Rolling back to N-1 inside the window is a two-way door: do it without asking when a threshold trips, then report. Repairing data a bad deploy wrote is a one-way door.
- When an objective's error budget is nearly spent, ship only small reversible changes; at zero, ship only fixes. Ask the user when the objectives and the budget policy are their call.
