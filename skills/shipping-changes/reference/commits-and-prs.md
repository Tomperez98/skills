# Commits and pull requests

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Commit, push, or open a PR only when the user asked or the active workflow says to. Use the repo's version-control tool for writes (for example GitButler's `but` when its skill is present), not whichever git command comes to mind.
- One logical change per commit. Never mix formatting, renames, or refactors with behavior changes.
- The subject follows the repo's convention (read `git log`). With none, use `type(scope): summary` in the imperative. The body says why and what it affects, not what the diff already shows.
- Commit only the paths you changed for this task. Read the staged diff first and scan it for secrets, debug output, and unrelated files.
- The changelog fragment goes in the same commit as the change it describes.
- Never force-push a shared branch, rewrite published history, or discard working-tree changes you didn't make; another person or agent may share the checkout. Each is a one-way door.
- Keep a PR small enough to review in one sitting: aim for 100–300 changed lines, since review catches less past about 400. Split anything near 1,000 into vertical slices, or into a refactor PR followed by a behavior PR. Lockfiles and generated files don't count toward the size, but say they're there.
- Keep branches short-lived, measured in days. Merge unfinished work behind a flag that defaults off instead of holding a long branch.
- The PR description says what changed and why, how it was verified (commands and results), what was deliberately left alone, and the open risks. It links the issue.
