# Fresh-context review

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply. A domain skill's own review format (such as the compatibility classification in shipping-changes) wins over the general one here.

- Use it for a non-trivial claim: branching logic, code that crosses a trust or service boundary, a property tests can't easily show (idempotence, ordering, concurrency safety), or anything just before a one-way door.
- Give the reviewer (a subagent, or a fresh session) only the artifact, its contract, and the evidence: the diff, the spec, check outputs, and the callers and tests that reach it. Never your conclusion or your reasoning.
- Ask adversarially: "Find inputs or states that break this contract, each with `file:line` and a reproduction, or say none found." Never ask "Is this good?". Scope it to correctness and say "skip style": a reviewer asked for problems always finds some, and fixing every one adds needless abstraction and tests for impossible cases.
- Give the reviewer read-only tools when the harness allows it, and ask for a short findings list, not a transcript.
- A fresh context buys independence, not intelligence: the same model on the same task, re-delegated, gives no better answer and costs extra tokens and the time to rebuild context. Delegate for review, parallel work, or to keep long output out of the main session.
- Report the findings as written, then classify each one: contract unclear (fix the spec), real defect (fix it), accepted trade-off (record why), or noise (note what context it lacked).
- Re-review after fixing. Stop after three rounds or when the findings are trivial. Still unresolved: escalate to the user. Too big for three rounds: split the artifact.
- With no fresh context available (you're already a subagent), say the review was a self-review, not an independent one.
- Sending code to an external model or service publishes it: ask first.
