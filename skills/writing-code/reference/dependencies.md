# Dependencies

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Count the transitive tree before adding a dependency and state the choice: write it, depend on it, or fork it. Write small helpers yourself. Depend on mid-size libraries, and fork-and-trim only with the user's OK. Always depend on crypto, protocols, and heavy frameworks; never roll your own.
- Pin exact versions in the manifest too. No floating ranges (`^1.2`). Vendor forks in-repo.
- Every update has a stated reason (security fix, user-hit bug, needed feature, toolchain reach). A bot PR is a proposal. Batch bot PRs weekly per ecosystem. A patch whose boundary tests stay green may auto-merge; everything else waits for a person.
- Review in proportion to risk, and state what you reviewed and what you didn't. Read the update's changelog and the lockfile diff, not just the version number.
- Triage audit findings by reachability. Fix reachable ones, and record each deferral with its reason and a review date. Never apply a forced fix just to silence the audit.
- Block install-time scripts by default and allow them per package. If you can't trust an update, take the minimum version with the fix.
- Wrap each dependency behind one module. It maps the dependency's errors into your vocabulary, parses its output, and panics on contract-violating output. Test that boundary against the outputs you parse and the errors you map.
