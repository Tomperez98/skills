# Rollout (several services)

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Release services in lockstep under one version, so the only pair that must work together is N-1 and N. Split one out only when it truly needs its own cadence; it then gets its own version, tag prefix, and baseline. Ask the user when lockstep or the window size is their call.
- Green at HEAD proves nothing about a rollout. On every PR that touches a contract between services, run N-1's suites against N (backward) and N's suites against N-1 (forward). Run only the directions your enforced deploy order can produce. A forward failure on a promise new in N is an ordering requirement: ship the provider first.
- Script the deploy order (usually providers first) and test exactly that: start everything at N-1, upgrade one at a time, specs judging throughout. Run it before each release and on a schedule with faults injected.
- Enforce the window at runtime: callers announce their version, and anything outside N-1..N gets a clear "too old" or "too new" error. A wider window (rollbacks, on-prem installs) keeps one shipped contract per supported version, each checked. Width is a cost you choose.
- Queued events and stored rows were written by N-1. Replay N-1's recorded events through N's specs, and migrate a copy of N-1's data and read it back through N's API. Widen readers before data loosens, and add a new shape before the code that writes it.
