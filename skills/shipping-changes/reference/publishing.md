# Publishing

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Separate `build --commit=<sha>` (no secrets, runs anywhere) from `publish --commit=<sha>` (protected job only). The build's output directory is the release. Generate install commands for the release notes from the build.
- Build once, test, and publish those exact bytes. Embed the version (and commit) in the artifact and assert it reports what you meant to build.
- Write a manifest beside the artifacts: name, version, commit, a checksum per file, and the contract files. Verification and resuming a partial publish read it, never memory or a re-glob.
- When stamping a version, assert the placeholder was found, so a renamed field fails the build instead of shipping `0.0.0`.
- Before any upload, assert the preconditions. Published files must be a subset of the built ones with the same checksums. The version must be new, or a partial publish of these exact bytes, and must be greater than the registry's latest. CI must have passed for this commit: ask CI or run the same definition, never a pasted copy. The built set must equal a hand-written expected artifact list, never whatever a glob finds.
- A version holding different bytes is taken: fail and bump. A version holding some of these bytes is a partial release: continue.
- Every way of starting a release runs every check. If publishing waits for approval, re-check right before the first upload.
- Each step checks whether it's already done and skips. Order: stage (draft release or staging repo), publish to each registry, then make it visible (release page, `latest`, announcement). Non-install steps like a docs rebuild come after it's visible. Bound network retries, then fail clearly.
- Credentials: available only to the release job, in a protected environment with an approval step, usable only from release tags. The job checks out that ref explicitly. The job holding the credential runs nothing but the upload; build and test run elsewhere and hand over the artifact. Release jobs build from a clean cache.
- Prefer short-lived credentials (OIDC, trusted publishing). Otherwise use one token per target, narrowly scoped, with an expiry and a written rotation procedure. No `set -x` in the job that holds a secret; mask it, and on failure report only the registry and the status.
- Only one release runs at a time, and it's never cancelled mid-way. Validation shares the lock. A failed release alerts someone.
- Verify from outside, after each publish and on a schedule, in a separate job. Every expected artifact downloads from where users get it. It matches the build by checksum, or by unpacked contents if a registry repackages. It installs into a clean environment from the public registry and passes a smoke test on the newest toolchains. `latest` points at it everywhere. Poll caches with a time limit.
- Run validation code from main against the latest released tag, but compare against the release's stored artifacts and use its own examples and fixtures. A mismatch fails loudly with the artifact name and both values.
