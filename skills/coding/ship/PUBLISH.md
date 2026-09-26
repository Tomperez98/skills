# Building, publishing, and verifying a release

You're writing or fixing the script that turns a commit into published
artifacts: binaries, packages, a release page, docs. It runs with
production credentials across several registries, and any one of them can
fail partway through. Make it safe to run again. Apply the rules in order.

## 1. One script: `--build` makes the artifacts, `--publish` ships them

```
release --build --sha=<commit>                  # anywhere: CI dry-run, validation
release --build --publish --sha=<commit>        # only in the release job
release --build --target=node --sha=<commit>    # one ecosystem, for debugging
```

A release usually coordinates several build tools (a compiler, `npm pack`,
`mvn`, `docker build`) as equals, so write the script as plain imperative
code rather than a build graph. Its output is a `dist/` folder, with one
subdirectory per ecosystem, and that folder *is* the release. Building
needs no secrets, so CI (CI.md rule 8) and validation (rule 8 below) run
exactly the same build.

- **Ship the bytes you tested.** Where you can, distribute built artifacts
  rather than asking users to build from source, and build them in the
  same mode you test (for example, with runtime safety checks on).
- **Make builds reproducible.** Pin the toolchain, and set archive
  timestamps from the commit instead of the current time. Rebuilding the
  same tag should give the same checksum.
- **Build libraries with the oldest toolchain you support**, so their
  lockfiles and metadata work for your oldest users.

## 2. Assert preconditions before changing anything

A release script that runs from a bad state is a bug, so check the state
first and stop if it's wrong (code skill: bugs panic):

```
assert(!release_exists(info.tag))          // never publish over a release
assert(release_exists(info.tag_previous))  // the release this one builds on
assert(info.previous < info.version)       // versions only go up
assert(run("./app --version") contains info.version)  // the binary knows its version
assert(size(artifact) <= artifact_size_max)           // size budget
```

Create output files exclusively (fail if they exist), so two steps that
write the same artifact fail instead of one silently overwriting the other.

## 3. List the artifacts by name; don't glob the folder

Write out every file you upload. The explicit list is a second check on
the build step: a missing platform fails the upload, and a stray file
doesn't get published. Validation checks against the same list. When you
change the list, search for anything that links to artifact names, such as
install docs.

```
artifacts = [
  "dist/app/app-x86_64-linux.zip",
  "dist/app/app-aarch64-linux.zip",
  "dist/app/app-universal-macos.zip",
  ...
]
upload(info.tag, artifacts)
```

## 4. Create a draft first; publish the release last

Use one place, usually the release page on your forge, as the sync point
for the whole run. Create it as a **draft** at the start, upload the
artifacts, publish to each registry, and mark it published and `latest`
only after every registry has succeeded. Put steps that can fail without
hurting users (docs, announcements) after that, so their failure doesn't
block the release. Generate the release notes: install commands for each
ecosystem, the compatibility range (RELEASE.md rule 6), then the changelog
entry.

## 5. Make every publish step idempotent

Before publishing to a registry, ask whether this version is already
there, and skip it if so. After a partial failure (npm published, Maven
failed), fix the cause, delete the draft, and run the whole thing again.
No version is burned. Retry network calls a bounded number of times, then
fail with a named error (CRASHONLY.md: make retryable effects idempotent).

```
fn is_already_published(registry, info) -> Result<bool, Error> {
    published = registry.latest_version()?     // network: expected failure
    assert(published <= info.version)          // newer than us? that's a bug
    return published == info.version           // yes → skip, no → publish
}
```

## 6. Protect the credentials and the trigger

- Trigger releases deliberately, and only from the frozen candidate
  (RELEASE.md rule 5). The job checks out that ref regardless of where it
  was started.
- Keep publishing secrets in a protected environment that needs approval
  from someone other than the person who started the run.
- Never let a release and its validation run at the same time, and never
  cancel either one partway through (one concurrency group, no
  cancel-in-progress).
- Prefer short-lived OIDC credentials (trusted publishing) where the
  registry supports it. Where it doesn't, use tokens scoped to one
  repository each, with an expiry. Document how to rotate them next to the
  code that uses them.
- Grant no permissions at the workflow level. The release job asks for
  exactly the scopes it uses.

## 7. Alert on failure; make the fix a re-run

The release job has an alert job that fires on any failure (MONITOR.md
rule 6). Write the runbook for the common cases:

- **Failed or partial publish:** fix the cause, delete the draft, run it
  again (rule 5).
- **Bad code in a shipped release:** make a fix-forward release
  (RELEASE.md rule 7).
- **Bug in the validation code:** fix it on main. Validation runs from main
  against the last tag (rule 8), so you don't need a new release.

## 8. Check what shipped, independently

Once the release finishes, and again on a schedule after that (MONITOR.md
rule 5), a separate job checks what users actually get. It checks out the
release **tag** into a fresh directory and runs the validation code from
**main**:

1. **All artifacts exist.** Download the release and assert that every
   file on the rule 3 list is present.
2. **Reproducible.** Rebuild from the tag and compare the checksum of each
   artifact with the downloaded one. Skip any builds your toolchain doesn't
   make deterministic, and say so in a comment.
3. **Packages match the build.** Download each package from its registry,
   unpack it, and diff it against the local build. Registries may repack
   archives, so compare the extracted contents, not the archive bytes.
4. **It runs.** Run the published artifact and assert that it reports the
   tag and the expected build mode. Then run a sample project against it,
   using each package from its registry.
5. **Latest is correct.** Every registry's latest version, and the image
   behind the `latest` container tag, match this release.

Any mismatch panics with the artifact name and both values, because
shipped bytes that differ from the tested bytes are a bug.

---

PUBLISH is the machine side of a boring release: build, check
preconditions, publish idempotently, then verify the result. RELEASE.md
decides when to run it. CI.md and MONITOR.md keep main in a state where
running it is routine.
