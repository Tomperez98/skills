# Writing a changelog and release notes

The changelog answers one question for a developer considering an upgrade:
*what changes, what breaks, and why should I move?* A changelog that lists
commits answers none of those. Apply the rules in order.

## 1. Keep the format (Keep a Changelog + SemVer)

One section per release, newest first, grouped by Added / Changed /
Deprecated / Removed / Fixed / Security. Version numbers follow SemVer so the
reader can tell at a glance whether this release is safe to take. Link each
release to its compare/diff.

```
## [2.1.0] - 2024-05-01
### Added
- `retry` now accepts a `max_attempts` option.
### Fixed
- Backoff no longer overshoots the cap by one interval.
```

## 2. Lead with what breaks

Breaking changes go first and loudest, each with a migration note: what to
change and what happens if you don't. Placing them first lets users find them
before production does.

```
### Changed (breaking)
- `retry(policy)` now takes a `RetryPolicy` object instead of positional
  args. Migrate: `retry(3, 100)` becomes `retry({ max_attempts: 3, base: 100 })`.
```

## 3. Write impact, not diff

Each entry is a sentence about what changed for the *user*, not the commit.
"Refactored the scheduler" says nothing; "Requests are now retried with
jitter, so stampedes don't recur" says what the reader gets.

## 4. One entry, one change

Each bullet is a single, complete change a reader can act on.
A bullet that needs "and" twice is two bullets.

## 5. Skip the noise

Log only changes that alter user-visible behavior; leave out internal
refactors, dependency bumps, and typo fixes. Every entry then matters, and
readers keep reading.

## 6. Write it as you go, not at release time

The changelog is a running document, updated in the same commit as the
change. Reconstructing it from the git log at release time yields commits with
extra steps, and it will be wrong.

Write each entry in its own file, not into one shared section: a single
"Unreleased" block that a hundred pull requests a day all edit is the most
contended file in the repo. Keep one fragment per change (a `.changes/`
directory), and assemble the release section from the fragments at release
time, so parallel pull requests never touch the same lines and the running
changelog still reads as one section.

## 7. The release notes answer "why upgrade"

The changelog is the record; the release notes are the pitch. In a release
post or announcement, lead with the headline change and the problem it
solves, in the reader's task vocabulary, with a before/after example. See
LANDING.md for the pitch craft.

## Done when

- The release has its own section with a SemVer number, a date, a compare
  link, and the standard groups (rule 1).
- Every breaking change comes first, with a migration note (rule 2).
- Each entry is one user-visible change, stated as its impact; no refactors,
  bumps, or typo fixes (rules 3–5).
- Each entry landed in the same commit as its change, as its own fragment
  file (rule 6).
- Release notes lead with the headline change and a before/after example
  (rule 7).
