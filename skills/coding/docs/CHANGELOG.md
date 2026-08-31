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
change and what happens if you don't. A breaking change buried at the bottom
is a breaking change your users discover in production.

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

Don't bundle. Each bullet is a single, complete change a reader can act on.
A bullet that needs "and" twice is two bullets.

## 5. Skip the noise

Don't log internal refactors, dependency bumps, or typo fixes unless they
change user-visible behavior. A changelog people trust is one where every
entry matters; a changelog full of noise teaches people to ignore it.

## 6. Write it as you go, not at release time

The changelog is a running document, updated in the same commit as the
change. A changelog reconstructed at release time from the git log is a list
of commits with extra steps — and it will be wrong.

## 7. The release notes answer "why upgrade"

The changelog is the record; the release notes are the pitch. In a release
post or announcement, lead with the headline change and the problem it
solves, in the reader's task vocabulary, with a before/after example. See
LANDING.md for the pitch craft.
