# Releases

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Keep the release checklist in the repo: numbered steps, exact commands, the reasoning after the steps, and a recovery procedure for each failure mode (partial publish, validation bug, bad release). Script every step you can.
- Never rush a change into a release. If unsure a release is ready, skip it. A regular cadence (e.g. weekly) makes skipping cheap. Ask the user when cadence or versioning scheme is their call.
- Keep the version in one place. Strongest form: the top changelog entry is the only source. Every manifest pins a placeholder (`0.0.0-dev`), and the release build stamps the real version into a temporary copy.
- Change the version in a reviewed PR. Derive the candidate from the last changelog entry and the changes since, and let the compatibility checks pick the bump.
- Build the changelog entry from the list of changes merged since the last release, then edit it for readers. A skipped release keeps its entry, marked unreleased, and the next release merges it in.
- Release a frozen commit. A script resolves remote main to a SHA and tags that. Never tag from a local checkout.
- Before publishing, confirm green for the frozen commit: CI, post-merge checks, compatibility, and the rollout test. Open failures must be triaged and metric jumps explained. Otherwise skip the release.
- Stop and ask once, before the first upload: show the commit, the version, and the changelog entry, then wait for "go".
- Published versions are immutable; fix forward through the same process, fast enough to run several times a day. If a fix seems to need an overwrite, re-tag, or re-publish, stop and ask. Yank or deprecate a dangerous release and tell users how to move off it. Write the emergency procedure down before you need it.
