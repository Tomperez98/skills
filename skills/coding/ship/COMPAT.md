# Keeping components compatible

You're shipping parts that have to work together, such as a server and its
clients, one library in several languages, or services that share a
protocol. And each release has to keep working with the versions already
out there. The failure here is drift: every part passes its own tests, and
they break when combined. Apply the rules in order.

## 1. Define the contract once; generate every copy

Types, error codes, wire formats, headers, and the bindings for each
language are written in one place, and everything else is generated from
it. Maintaining a copy by hand in each language means one more copy to
drift apart with every language you add.

Also test that the generated output agrees with its source, for example by
compiling the generated header against the original definitions, so a bug
in the generator fails too.

## 2. Commit generated files; fail CI when they're stale

Commit what you generate, so it can be reviewed and used without running
the generator. One command regenerates everything locally. In CI the same
command runs in check mode, and fails with the file name if regenerating
would change anything:

```
./generate           # locally: rewrite only the files whose content changed
./generate --check   # CI: exit 1, "bindings.go is outdated; run ./generate"
```

The same applies to everything derived: READMEs built from templates, API
listings, lockfiles. Repositories you publish into, such as a language
mirror or a docs site, are outputs too. The release script pushes to them,
stamps each commit with the source commit, and nobody edits them by hand.

## 3. Hold every implementation to the same scenarios, against the real thing

Define the scenarios once: a list of sample programs, or one workload with
a driver for each language. Then run all of them for every client, against
a real server built from the same commit. Don't use a mock; a mock is one
more copy of the contract. When you add a client, the list tells it what it
has to pass. When you add a scenario, every client gets it.

Install the packaged artifact into a clean container for each environment
users run (distributions, C library variants, runtime versions), because
packaging is where these breaks usually show up first. Run the long
versions of these workloads after merge (MONITOR.md rule 1).

## 4. Cut docs code from files CI runs

Every code snippet in the docs comes from a sample program that CI runs,
extracted between markers (`// section:create-account`) and kept fresh by
rule 2. A snippet typed straight into Markdown drifts from the API without
anyone noticing. A snippet cut from a tested file can't. This is how you
enforce the docs skill's "the example must run as pasted".

## 5. Release the parts together, or publish the window

If the parts must match, keep them in one repo and release them together
under one version. Then there's no internal compatibility matrix to test.

Where versions can differ, such as old clients talking to a new server or
a deployment halfway through an upgrade, declare the supported window as
data, in one place:

```
oldest_supported_client = "1.4.0"
assert(current_release >= oldest_supported_client)   // checked at build time
```

Print the window in the release notes (PUBLISH.md rule 1). Each side checks
the other's version when they connect, and rejects a version outside the
window with an error naming both versions. Guessing at compatibility just
turns a version mismatch into a bug nobody can explain later (code skill:
bugs panic).

## 6. Give each release two identities: tag and compatibility

Keep the public version — the git tag and the package version users
install — separate from the compatibility version: the protocol, ABI, or
data-format release that decides what can talk to what. They usually
match, and CI asserts that they do. But a fix-forward release can pin the
compatibility version to the broken release's, so clients and replicas
treat it as the same release while the public tag moves on. Without the
split, the only way to fix a release whose upgrade path is broken is to
also break compatibility.

## 7. Switch changed behavior on the caller's version

When behavior has to change incompatibly, switch it on the version the
caller reports. Old callers keep the old behavior, new callers get the new
one, and the old path is deleted once it falls outside the window (rule 5).
Document each breaking change for each client, with before-and-after code,
on a migration page that the release notes link to.

## 8. Test upgrades against the releases users actually have

In CI, download the previous published releases rather than rebuilding
them from old tags. Test the combinations users will hit: an old client
against the new server, a deployment running mixed versions, and an
in-place upgrade from the previous release to this commit while it's
serving traffic. An upgrade test that only uses versions you built today
tests code nobody is running.

## 9. Leave nothing orphaned

Fail CI on source files that nothing references, on file types outside an
allowlist, and on large files anywhere in the git history. Build the docs
site in CI and fail on broken internal links. When a page moves, add a
redirect from its old address. Each of these is a part that no longer fits
with the rest, and nothing else would catch it.

---

COMPAT keeps the parts in agreement with each other and with what's already
deployed. CI.md runs these checks on every merge, MONITOR.md runs the long
workloads and upgrade tests, and RELEASE.md publishes the window with each
release.
