# Review routing (where behavior is an executable spec)

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Label every PR by what it does to the contract. **Unchanged:** no spec or schema change, and specs green in both directions. **Additive:** new operations or outcomes, old contract still green; one spec owner approves. A new value in a closed set is breaking. **Breaking:** the old contract rejects the build; spec owners approve the declared break. **Baseline:** the first contract; blocks nothing.
- Put spec and schema directories under named owners (`CODEOWNERS`).
- Post the PR's own promise diff (against its base, not the last release), which side moved, and a runnable replay of every failure. Fail the build when a public operation has no spec, a spec rule never runs, or a test asserts on responses itself.
- The job that checks PR code holds a read-only token and uploads its verdict as data. A separate job triggered by its completion (`workflow_run` on GitHub) holds the write token, checks out only the base, and validates the verdict as untrusted input. It applies the verdict idempotently as a label and a check, only if the verdict matches the current head and base. Recompute the verdict in the merge queue.
- Treat labels as information until the specs have caught real bugs. Only then let "unchanged" merge on green alone.
- Watch the gate's numbers: the share of additive or breaking PRs, flake rate, verdict latency, and owner approval time. Version a hot surface or move it behind a stable boundary.
