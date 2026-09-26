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

## 2. Ship the bytes you tested

Build an artifact once, test it, and publish that same file. Rebuilding it
in the publish step gives you something you haven't tested. Aim for
reproducible builds, with pinned toolchains and timestamps and paths that
don't vary, so anyone can rebuild a tag and get the same checksum.

## 3. Check preconditions before any side effect

Before uploading anything, assert that the state is what you expect (code
skill: bugs panic):

```
assert(!registry.has(version))          // never publish over a release
assert(version > registry.latest())     // versions only go up
assert(ci_passed(commit))               // the commit is the tested one
assert(all_expected_artifacts_exist())  // nothing missing, nothing extra
```

It's much cheaper to fail here than halfway through publishing.

## 4. Make every step idempotent; publish visibly last

Each step first checks whether it has already been done, and skips if so:

```
fn publish_to(registry, version) -> Result<(), Error> {
    if registry.has(version)? { return Ok(()) }   // already done: skip
    registry.upload(artifact)?                     // network: expected failure
}
```

Order the steps so that a partial failure never leaves users on a broken
release. Stage first: a draft release or a staging repository. Publish to
each registry. Make it visible last: the public release page, the `latest`
tag, the announcement. After a failure, fix the cause and run the whole
thing again, and no version is burned. Retry network calls a bounded number
of times, then fail with a clear error (CRASHONLY.md: make retryable effects
idempotent).

## 5. Protect the credentials

- Publishing secrets are available only to the release job, in a
  protected environment that needs a second person's approval.
- Prefer short-lived credentials (OIDC or trusted publishing) over
  long-lived tokens. When you do need a token, scope it narrowly, give it
  an expiry, and write down how to rotate it.
- Only one release runs at a time, and a running release isn't cancelled
  partway through.
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
   environment, and run a smoke test or a sample project against it.
4. **Pointers are correct.** `latest` on every registry and image tag
   points to this release.

A mismatch here means users are getting something other than what you
tested, so treat it as a bug and fail loudly with the artifact name and
both values.

---

PUBLISH is the machine side of a boring release: build once, check before
acting, publish in a way that can be re-run, then verify from the outside.
RELEASE.md decides when to run it.
