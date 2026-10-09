# Keeping releases backward compatible

You're deciding whether a change breaks the people already using the last
release: a renamed field, a stricter validation, a status code that moved.
A break nobody declared is a bug users find for you. The fix is mechanical:
keep the released contract, and let it judge every new build. Apply the
rules in order.

## 1. The contract has two layers; check both

- **Shape:** the names, types, and signatures a client compiles or
  serializes against: a schema (OpenAPI, protobuf, GraphQL), or a library's
  public API.
- **Behavior:** what the system does with a well-formed call: which
  requests succeed, which are refused, what comes back, how state moves.

A schema diff can't see that a valid order now gets a 409. A behavior check
can't see that a field was renamed if the old suite never read it. Neither
replaces the other.

## 2. Check shape with a diff against the last release

Diff the current schema or public API against the one from the last
released tag, with a tool that classifies each change as breaking or not:
`oasdiff breaking` (OpenAPI), `buf breaking` (protobuf), GraphQL Inspector,
`cargo-semver-checks` (Rust), API Extractor (TypeScript), package
validation with a baseline version (.NET), `japicmp` (Java), `apidiff`
(Go), `griffe check` (Python). It runs in seconds, so it belongs in the
fast tier (CI.md rule 2).

If the schema is generated from code, regenerate it in CI and fail on a
diff (CI.md rule 9), or the check compares two stale files.

Never reuse a removed identifier: an enum value, a field number, an event
type, an operation name. Reserve it. An old caller or an old message still
means the old thing by it.

## 3. Write behavior down as an executable spec

Behavior is checkable only when it's written as code that judges responses,
not asserts scattered across tests. A spec that maps (request, state) to the
correct responses can judge any build, including one it has never seen
(accordant skill). Hand-written asserts tied to today's implementation
can't be pointed at the next release.

The spec sees the system only through its API: requests in, responses and
published events out. It checks what a caller can observe, never tables,
internal calls, or private state. That boundary is what makes it a
compatibility check: callers depend on the API, so the API is what must
not change underneath them.

## 4. Ship the contract with the release

Put the schema, the spec, and the test sequences it generated into the
release, and list them in the manifest (PUBLISH.md rule 2). The next
release's checks then read the contract that actually shipped, not one
rebuilt from memory or from a tag that was patched later.

If the last release shipped no contract, make one: write the spec on main,
then run it against the last release's published artifact. Green means it
describes what users already have; freeze that as the baseline. Red means
either the spec is wrong or main already broke something, and you just
found out before the release did.

## 5. The released contract judges every build

On every pull request that can change behavior, run the last release's
suite (its spec, its sequences, its client) against the new build. Judge
the responses with the old spec, never by comparing them to recorded
responses byte for byte: IDs, timestamps, and ordering legitimately change,
and an exact match fails on all of them. The spec knows which fields must
match and which only have to exist.

The suite stays the old one on purpose. Old clients send old requests, so
the check is exactly what they will experience after upgrading.

Which release is "the last" depends on where the check runs. A release
build is judged against the release before it: that's where a break gets
decided. Everything else (pull requests, main, scheduled runs) is judged
against the latest release at or before the commit, even one tagged on the
commit itself. Otherwise a scheduled run on a released commit re-reports
that release's break every time, and a published version can't be fixed,
only superseded (RELEASE.md rule 7), so the failure teaches people to
ignore red.

## 6. A break is a decision, declared in the release

When rule 2 or rule 5 fails, either the change is a bug (fix it) or the
break is deliberate. A deliberate break lands only with a breaking entry,
and a migration note, in the top changelog entry (docs skill, CHANGELOG.md),
which makes the next version a major bump (RELEASE.md rule 3). CI enforces
the pairing: a compatibility failure with no breaking entry fails the
build (CI.md rule 7). After the major release ships, its contract becomes
the new baseline.

Only that undeclared break is an error. Give every other result its own
level, so red keeps meaning "stop":

- **Undeclared break:** error; the build fails.
- **Declared break:** a notice, the fact the release notes must explain.
- **Promise reworded or removed, old contract still green:** a warning; a
  spec owner reviews the wording.
- **New promises only, or nothing changed:** silent.

Prefer deprecation to removal: keep the old behavior for at least one
release, warn when it's used, and say in the changelog when it goes away.

## 7. Run the slow suites on a schedule, not on every pull request

Concurrency checks (do two simultaneous calls give a result some
one-at-a-time order explains?), fault injection (timeouts, lost
responses), and deeper exploration grow fast with every input. Run them
against main on a schedule and against the frozen commit before a release
(MONITOR.md rule 1, RELEASE.md rule 6), with the released contract as the
judge, just like rule 5. One green run proves little; a failure that comes
and goes is the race you're looking for, not a flaky test (CI.md rule 5).

## 8. Several services: release them in lockstep

Rules 8–12 apply only to a repo with several services or parts that talk
to each other. A single package stops at rule 7. Adopt them one service at
a time, starting with the one the most others depend on: each check below
costs real infrastructure, and it pays first where a break would hurt the
most callers.

A repo with several services releases them together, under one version
from the changelog (RELEASE.md rule 3). One version means one baseline,
and the only pair that ever has to work together is the last release, N-1,
and the new one, N. Give a service its own version, tag prefix, and
baseline only when it truly needs its own cadence; every one you split out
multiplies the pairs to check.

## 9. Green at HEAD proves nothing about the rollout; check N-1 both ways

A pull request that changes a provider and its consumer together passes at
HEAD, because both sides match there. Production never runs HEAD alone:
deploys roll out one service at a time, so N-1 and N run side by side for
minutes or hours. Check both directions on every pull request that touches
a contract between services:

- **Backward:** N-1's suites, every service's, judge N's build (rule 5).
- **Forward:** N's suites judge N-1's build, because during the rollout new
  consumers reach old providers.

## 10. Test the rollout in the order you deploy

Write the deploy order down and script it, usually providers before
consumers. Then test exactly that order: start every service at N-1,
upgrade them one at a time, and keep every spec judging the whole way.
Run it before each release (RELEASE.md rule 6) and on a schedule with
faults injected (rule 7), since a restart mid-request is part of every
real rollout.

## 11. Enforce the window at runtime

The supported window is N-1 to N. Make callers announce their version and
refuse anyone outside it with a clear "too old" or "too new" error. A
caller outside the window otherwise gets undefined behavior, and the first
sign is corrupt data instead of an error.

## 12. Messages and data outlive the deploy

Events already in queues and rows already stored were written by N-1, so N
must read them. Events are part of the API: replay N-1's recorded events
through N's specs. Stored data isn't, and the specs can't see it: check it
by migrating a copy of N-1's data, then reading it back through N's API
with the specs judging the responses. A schema change to stored data runs
as expand, migrate, contract, spread over at least two releases: add the
new shape and write both, move readers over, then remove the old shape
once no N-1 code is left.

---

COMPAT keeps "releasable" true for the people downstream and for the
services next door: CI runs the checks, MONITOR runs the slow ones, and
RELEASE turns the result into the version number and the rollout.
