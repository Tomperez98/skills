# Changelog and release notes

Part of the writing-docs skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- One section per release in SemVer, newest first, dated, linked to its compare/diff, grouped Added / Changed / Deprecated / Removed / Fixed / Security.
- Breaking changes go first, each with a migration note: what to change, and what happens if you don't (`retry(3, 100)` becomes `retry({ max_attempts: 3, base: 100 })`).
- Each entry states the impact for the user, not the diff. One entry, one change: a bullet that needs "and" twice is two bullets.
- Skip internal refactors, dependency bumps users can't see, and typo fixes. A dependency update that fixes a security issue or changes behavior is an entry.
- Write each entry in the same commit as its change, as its own fragment file (e.g. `.changes/`), never into one shared "Unreleased" block. Assemble fragments at release time.
- Release notes are the pitch, not the record. Lead with the headline change and the problem it solves, with a before/after example.
