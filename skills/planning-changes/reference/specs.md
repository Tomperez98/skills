# Specs

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Turn every vague goal into a checkable criterion ("faster" becomes "p95 of /search under 300 ms on the fixture dataset"). Confirm the targets the user owns before building.
- A spec states the objective, the users, the success criteria, boundaries (always, ask first, never), non-goals, and open questions. Link commands and conventions already in the rules file instead of restating them.
- Use the repo's existing spec location and format. With none, put the spec where the user says, or in the PR description.
- A request with several independently testable capabilities gets a module map before any spec: each module has a stable ID, what it owns, its interface, and its dependencies, which point one way. Two modules that depend on each other are one module. Build in dependency order.
- Each decision that's expensive to reverse also gets an ADR (writing-docs).
- Keep the spec current: when a decision changes, update the spec in the same change as the code.
