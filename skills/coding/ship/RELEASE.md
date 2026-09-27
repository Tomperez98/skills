# Running the release process

You're deciding what ships, what it's called, and what happens when it's
wrong. Whatever the cadence, the process should be dull enough that anyone
on the team can run it. Apply the rules in order.

## 1. Write the checklist down, and rotate who runs it

Keep the release checklist in the repo: numbered steps with the exact
commands, and the reasoning after the steps. Script every step you can
(PUBLISH.md). If only one person knows how to release, the project can
only release when that person is available.

Rotate the release manager so everyone on the team has run a release. When
the process has two halves, such as freezing a candidate and publishing it
later, give them to different people, so each checks the other's work. The
checklist also covers recovery: for each way a release can fail (a publish
that stopped partway, a bug in the validation, a bad release), write down
what to do and how to run it again.

## 2. Never rush a change into a release

If someone wants to land a change just to get it into a release, let it
land at its normal pace and release it later. If you're unsure whether a
release is ready, skip it. A late release costs a little time, and a rushed
one ships the bug that a bit more testing would have caught.

A regular cadence, such as weekly, is what makes this cheap: when the next
release is days away, skipping one costs nobody much.

## 3. Keep the version in one place

Store the version in one place and have everything else read it from
there. The strongest form is to store no real version in source at all:
make the top changelog entry the only source of truth, pin a placeholder
(`0.0.0`, `0.0.0-dev`) in every manifest, and have the release build stamp
the real version into a temporary copy of each file. A dev build then never
carries a version that could be mistaken for a release, and nobody
hand-edits the same number in seven places. When the same version string is
written in several files, they drift apart; a placeholder that a script
rewrites can't.

Change the version in a reviewed pull request like any other change, so a
second person checks the number before it ships. Derive the next version
number from the last changelog entry (patch + 1) rather than typing it;
the human's job is to verify it, not produce it.

Versions only go up. A number that was published, or burned by a failed
attempt, is never used again. Pick a scheme users can understand, such as
SemVer, and stick to it.

## 4. Build the changelog from what merged

Start from the list of changes merged since the last release, so nothing
gets left out. Then edit it for readers: group related changes, drop the
trivial ones, and put breaking changes first, with migration steps. The raw
list is for checking completeness; what users read is the edited entry. For
how to write each entry, see docs/CHANGELOG.md.

A skipped release still gets its entry, marked as unreleased. The next
release merges every unreleased entry into its own, so users upgrading from
the last published version see everything that changed.

## 5. Freeze a tested commit on main

Choose a specific commit on main that has passed CI and the post-merge
checks (MONITOR.md), and release exactly that commit, never whatever a
branch happens to point at when the job starts. Create the tag with a
script that resolves the remote main to a SHA and tags that, never your
working copy: a local checkout can hold commits, including ones your tools
made, that main never had.

If you use a release branch, it only ever points at a commit on main:
move it forward (`git push origin <sha>:release`), and never cherry-pick
or commit to it directly. A release branch with its own commits ships code
that main never tested. The release job builds that branch whatever ref it
was started from.

## 6. Let the candidate soak, then approve

Run the long tests (fuzzing, soak tests, the full platform matrix) against
the frozen candidate for a set time, such as over a weekend, before you
publish it. Right before publishing, check that those runs are still green,
that open failures are triaged, and that metric changes are explained. If
not, skip this release (rule 2).

Have a second person approve the publish step. It costs one click and
catches the mistakes the person running the release can't see.

## 7. Published versions are immutable; fix forward

Never overwrite, re-tag, or re-publish an existing version. Users and
caches have already pulled it. If a release is bad, ship a new version with
the fix, through the same process. Keep that process fast enough to run
several times in one day, so fixing forward is never the slow option. When
a release is dangerous to keep running, also mark it (yank or deprecate it
on the registry, and flag it on the release page) and tell users how to
move off it.

If a fix can't ship through the normal path, for example when upgrading to
the new version is itself broken, write the emergency procedure down before
you need it, not during the incident.

---

RELEASE decides what ships and what it's called. CI.md and MONITOR.md
decide whether it's ready, and PUBLISH.md does the shipping.
