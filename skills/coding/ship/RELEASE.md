# Running the release process

You're deciding what ships, what the version is, and what to do when a
release goes wrong. Whatever the cadence, the goal is a process dull enough
that anyone on the team can run it and nobody dreads it. Apply the rules in
order.

## 1. Write the checklist; don't rely on a person

Keep a release checklist in the repo: numbered steps with the exact
commands, and the reasoning after the steps. Someone at step 4 wants the
command, not the rationale. The knowledge lives in the checklist and the
scripts, not in one person's head, so anyone can run a release. Having
different people run them keeps the checklist honest.

## 2. Never rush a change into a release

If someone feels pressure to land a change before a release, let it land
at its normal pace and release later. When unsure whether to release,
wait. A delay costs a little time; a rushed release can ship the bug that
soaking would have caught. This only works if releasing is cheap, which is
what the rest of this skill is for.

## 3. Keep the version in one place

Store the version in exactly one place and derive it everywhere else: the
top entry of the changelog, a git tag, or one manifest field, but not a
string repeated across the source tree. The release script reads it from
that place. Validate it with a parser that CI runs as a test, so a
malformed or out-of-order version fails the build, not the release.

```
assert(entry.version > previous.version)  // newest first, strictly increasing
```

Versions only go up but can have gaps. A number burned by a failed attempt
stays burned, and you never reuse it. Unreleased work sits under an
`Unreleased` heading until it gets a version.

## 4. Scaffold the changelog from merges, then curate

Generate a skeleton from the changes merged since the last release (for
example `git log --merges --first-parent <last-release>..main`), so nothing
is missed. Then edit it into something people will read:

- sort into buckets that suit the project, such as *Safety and
  performance*, *Features*, *Internals*;
- drop trivial changes and group related ones into one bullet that tells
  the story;
- describe safety and performance changes by their effect on users;
- keep meaningful internal changes even if users can't see them, since the
  changelog is also the team's shared record.

The merge list is a checklist, not the finished entry. If the team writes
entries as it goes (docs/CHANGELOG.md rule 6), the scaffold is how you check
that nothing was left out. For how to write each entry, see
docs/CHANGELOG.md.

## 5. Freeze a candidate, soak it, then publish

Freeze the candidate by pointing a release branch or tag at a commit on
main that passed CI. Let long-running tests run against it for a while
(MONITOR.md rule 1). Before publishing, check for failures on the candidate,
read the dashboard, and triage anything open. Start the release from the
frozen candidate, never from a moving branch, and have someone other than
the person who started it approve the publish step (PUBLISH.md rule 6).

## 6. State compatibility in every release

If users upgrade in place or run mixed versions, each release says how far
back it reaches:

- **Oldest version you can upgrade from.** Anything older needs to step
  through intermediate releases.
- **Oldest compatible client or peer version,** and which side upgrades
  first.

Treat both as guarantees and put them in the release notes. Derive them
from the build rather than typing them by hand. Any change that touches
cross-version behavior gets an extra reviewer (CI.md rule 3).

## 7. Fix forward; hotfix only when the normal path is broken

If a shipped release has a bug, make a normal release with the fix. It
goes through the same checks and the normal upgrade path, and there's no
limit on how soon it can follow. Rolling back leaves users on two
different histories.

Special hotfixes (a patch on an old branch, or a rebuild that reuses a
version's compatibility identity under a new tag) are only for when the
normal upgrade itself is broken. Make them an explicit override: the
release script asserts the normal invariants, and the release manager has
to change that assert on purpose. It shouldn't be possible to do by
accident.

---

RELEASE decides what ships and what version it is. CI.md and MONITOR.md
keep main in shape to cut from, and PUBLISH.md turns "go" into artifacts
that have been built, published, and checked.
