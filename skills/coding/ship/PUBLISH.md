# Building, publishing, and verifying a release

You're writing or fixing the script that turns a commit into published
artifacts. It runs with production credentials against systems that can
fail partway through, so it has to be safe to run again. Apply the rules in
order.

## 1. Separate build from publish

```
release build   --commit=<sha>   # no secrets; runs anywhere, including CI
release publish --commit=<sha>   # only in the protected release job
```

Building produces every artifact in one output directory, and that
directory is the release. Publishing only uploads what's already there.
Because the build needs no credentials, CI can run it on every merge
(CI.md rule 8) and validation can run it again later (rule 6).

Generate the mechanical parts of the release notes too: the install
command for each package manager, and the compatibility facts (the oldest
version users can upgrade from, which versions work together; COMPAT.md
rule 5). Take them
from the build, not from memory. People write only the story of what
changed (RELEASE.md rule 4).

## 2. Ship the bytes you tested

Build an artifact once, test it, and publish that same file. Rebuilding it
in the publish step gives you something you haven't tested. Aim for
reproducible builds, with pinned toolchains and timestamps and paths that
don't vary, so anyone can rebuild a tag and get the same checksum. If some
outputs can't be reproduced, such as debug builds, list them, and compare
checksums for everything else.

Build and publish with the oldest toolchain you support, not the newest. A
package built with the newest compiler or lockfile format can fail for
users on older tools, and you won't see it, because your own tools are new.

Make every artifact identify itself: embed the version, commit, and build
mode, and expose them (`app version --verbose`). After building, run the
artifact and assert it reports what you meant to build. A debug build
published as a release, or a stale version string, fails here instead of
on a user's machine.

When you stamp the version into a manifest at build time, write into a
temporary copy and assert that the placeholder was actually found, then
restore the file. If someone renames the placeholder field, the release
build fails loudly instead of shipping `0.0.0` (code skill: bugs panic).

## 3. Check preconditions before any side effect

Before uploading anything, assert that the state is what you expect (code
skill: bugs panic):

```
published = registry.files(version)            // empty if the version is new
assert(published ⊆ built, same checksums)      // never publish over other bytes
assert(published or version > registry.latest())  // versions only go up
assert(registry.has(previous_version))         // what this release builds on exists
assert(ci_passed(commit))                      // the commit is the tested one
assert(built == expected_artifacts)            // nothing missing, nothing extra
```

A version that already holds different bytes is taken: fail, and bump the
version. A version that holds some of these exact bytes is a release that
stopped partway: carry on, and rule 4 uploads the rest. Failing on "the
version exists" alone turns every partial failure into a burned version.

Write the expected artifacts out as a list by hand, in the publish step and
again in validation, rather than uploading whatever a glob finds. The list
checks the build logic independently instead of trusting it.

`ci_passed` asks CI for this commit's result, or runs the same CI
definition. A copy of the suite pasted into the release job drifts: it
quietly loses a platform or a language version, and still says "the same
checks as CI".

Every way of starting a release runs every check. A check guarded by "only
when started from a tag" is skipped by exactly the manual run that needs
it, so either make the check fail outside that case or remove the other way
in. If publishing waits for an approval, run the checks again right before
the first upload, because the registry can change while it waits.

It's much cheaper to fail here than halfway through publishing.

## 4. Make every step idempotent; publish visibly last

Each step first checks whether it has already been done, and skips if so:

```
fn publish_to(registry, artifact) -> Result<(), Error> {
    if registry.has_file(artifact.name)? { return Ok(()) }  // same bytes (rule 3): skip
    registry.upload(artifact)?                               // network: expected failure
}
```

Order the steps so that a partial failure never leaves users on a broken
release. Stage first: a draft release or a staging repository. Publish to
each registry. Make it visible last: the public release page, the `latest`
tag, the announcement. Put steps users don't need to install the release,
such as rebuilding the docs site, after it's visible, so their failure
can't block it. After a failure, fix the cause and run the whole thing
again, and no version is burned. Retry network calls a bounded number of
times, then fail with a clear error (CRASHONLY.md: make retryable effects
idempotent).

## 5. Protect the credentials

- Publishing secrets are available only to the release job, in a
  protected environment that needs a second person's approval and can only
  be used from the release branch or tags. The job checks out that ref
  explicitly, whatever ref it was started from.
- The job that can obtain the credential runs nothing but the upload.
  Building and testing install third-party tools (test runners, linters,
  build plugins), so run them in a job without the credential and hand the
  tested artifact across. That also makes rule 2 true by construction.
- Release jobs restore no caches. Another branch can write a cache that
  the release would then trust.
- Prefer short-lived credentials (OIDC or trusted publishing) over
  long-lived tokens. When you do need a token, use one per registry or
  target repository, scope it narrowly, give it an expiry, and write down
  how to rotate it.
- Only one release runs at a time, and a running release isn't cancelled
  partway through. Validation (rule 6) shares that lock, so it never
  checks a release that's still being published.
- If the release fails, alert someone (MONITOR.md rule 4).

## 6. Verify what shipped, from the outside

A successful upload doesn't prove users can install the release. After
publishing, and again on a schedule (MONITOR.md rule 3), have a separate
job check it the way a user would:

1. **Everything is there.** Every expected artifact can be downloaded from
   the places users get it from.
2. **It matches the build.** The published artifacts match the ones you
   built and tested, by checksum or, when a registry repackages them, by
   comparing the unpacked contents.
3. **It works.** Install it from the public registry into a clean
   environment, and run a smoke test or a sample project against it. Use
   the newest toolchains users might have, since the build (rule 2) already
   covers the oldest.
4. **Pointers are correct.** `latest` on every registry and image tag
   points to this release.

Registries serve through caches, so a new release can take minutes to
appear. Poll for it with a time limit, then fail; don't fail on the first
miss or sleep for a fixed time.

Run the validation code from main against the latest released tag, not
the copy that shipped with the release. Then a bug in the validation is
fixed on main, without cutting a new release. Take everything else from
the release: compare against the artifacts stored with it, not a rebuild,
since today's toolchain can produce different bytes for an old tag, and
run the release's own examples and fixtures, since main's may use API the
release doesn't have. Skip the check after a release job that failed;
that failure already alerted someone.

A mismatch here means users are getting something other than what you
tested, so treat it as a bug and fail loudly with the artifact name and
both values.

---

PUBLISH is the machine side of a boring release: build once, check before
acting, publish in a way that can be re-run, then verify from the outside.
RELEASE.md decides when to run it.
