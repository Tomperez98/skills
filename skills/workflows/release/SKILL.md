---
name: release
description: >
  Cut a release: pick the version, write the changelog entry, freeze a
  green commit, publish, and verify. Invoked by name only.
disable-model-invocation: true
---

# Release

Run one release from merged changes to a verified install. Each step loads
the skill that owns its rules and ends in a `Done:` check; finish it before
the next step starts. Everything here follows from one rule:

> **Ship one frozen, green commit, and ask before the first upload.**

If the repo has no written release checklist or no release script yet,
build those first: call the Skill tool with "ship" and follow its
RELEASE.md, then PUBLISH.md. Then come back here.

## 1. Pick the version

Call the Skill tool with "ship" and follow its COMPAT.md: the shape diff
and the released contract (ship skill, COMPAT.md rules 2 and 5) decide
whether this is a patch, minor, or major. A break nobody declared stops
the release until it is fixed or declared (ship skill, COMPAT.md rule 6).
With several services, call the Skill tool with "ship" and follow its
ROLLOUT.md as well.

Done: the next version is named, with the check results that picked it.

## 2. Write the changelog entry

Call the Skill tool with "docs" and follow its CHANGELOG.md. Start from the
list of what merged since the last tag (ship skill, RELEASE.md rule 4).

Done: the top entry carries the new version, breaking changes first with a
migration note each, and the version lives in one place (ship skill,
RELEASE.md rule 3).

## 3. Freeze and confirm

Call the Skill tool with "ship" and follow its RELEASE.md: resolve remote
main to a SHA that passed CI and the post-merge checks (ship skill,
RELEASE.md rule 5), then confirm it is still green (ship skill, RELEASE.md
rule 6).

Done: one SHA, with CI, post-merge, and compatibility results green for
that SHA.

## 4. Stop and ask

Show the frozen SHA, the version, and the changelog entry, and wait for a
"go". Steps 1–3 run without asking because each can be redone. Step 5
can't be undone.

Done: the user said "go" to this SHA and version.

## 5. Publish and verify

Call the Skill tool with "ship" and follow its PUBLISH.md: run the publish
step against the frozen SHA, then the outside-in check (ship skill,
PUBLISH.md rule 6). A failure partway through is resumed by running publish
again (ship skill, PUBLISH.md rule 4), never by changing the version's
bytes. A bad release that already shipped is fixed forward (ship skill,
RELEASE.md rule 7); if the fix seems to need an overwrite, stop and ask.

Done: a clean install of the new version from the public registry passes
its smoke test, and `latest` points at it.

## Done when

- The version came from the compatibility checks, and every break is
  declared (step 1).
- The changelog entry is on main before the tag (step 2).
- The tag is the SHA shown at the stop, and the user said "go" to it
  (steps 3 and 4).
- The release installs and runs from the outside (step 5).

## Hand off

- **The release process or script itself needs fixing** → call the Skill
  tool with "ship" and follow its RELEASE.md or PUBLISH.md.
- **Something went red along the way** → tell the user to type
  `/diagnose`.
