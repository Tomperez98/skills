# Running the release process

You're deciding what ships, what it's called, and what happens when it's
wrong. Whatever the cadence, the process should be dull enough that anyone
on the team can run it. Apply the rules in order.

## 1. Write the checklist down

Keep the release checklist in the repo: numbered steps with the exact
commands, and the reasoning after the steps. Script every step you can
(PUBLISH.md). If only one person knows how to release, the project can
only release when that person is available.

## 2. Never rush a change into a release

If someone wants to land a change just to get it into a release, let it
land at its normal pace and release it later. If you're unsure whether a
release is ready, wait. A late release costs a little time, and a rushed
one ships the bug that a bit more testing would have caught.

## 3. Keep the version in one place

Store the version in one place, such as a git tag, one manifest field, or
the top changelog entry, and have everything else read it from there. When
the same version string is written in several files, they drift apart.
Versions only go up. A number that was published, or burned by a failed
attempt, is never used again. Pick a scheme users can understand, such as
SemVer, and stick to it.

## 4. Build the changelog from what merged

Start from the list of changes merged since the last release, so nothing
gets left out. Then edit it for readers: group related changes, drop the
trivial ones, and put breaking changes first, with migration steps. The raw
list is for checking completeness; what users read is the edited entry. For
how to write each entry, see docs/CHANGELOG.md.

## 5. Release a frozen, tested commit

Choose a specific commit on main that has passed CI and the post-merge
checks (MONITOR.md), and release exactly that commit, never whatever a
branch happens to point at when the job starts. Before publishing, look for
open failures and unexplained metric changes. Have a second person approve
the publish step. It costs one click and catches the mistakes the person
running the release can't see.

## 6. Published versions are immutable; fix forward

Never overwrite, re-tag, or re-publish an existing version. Users and
caches have already pulled it. If a release is bad, ship a new version with
the fix, through the same process. When a release is dangerous to keep
running, also mark it (yank or deprecate it on the registry, and flag it on
the release page) and tell users how to move off it.

---

RELEASE decides what ships and what it's called. CI.md and MONITOR.md
decide whether it's ready, and PUBLISH.md does the shipping.
