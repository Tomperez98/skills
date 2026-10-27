# Keeping releases backward compatible

You're deciding whether a change breaks the people already using the last
release: a renamed field, a stricter validation, a status code that moved.
A break nobody declared is a bug users find for you. The fix is mechanical:
keep the released contract, and let it judge every new build. Apply the
rules in order; with several services that talk to each other, continue
with [ROLLOUT.md](ROLLOUT.md).

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

Diff only the schema files the pull request touched, and run the full set
on main and the release. Diffing
every schema on every pull request spends the whole surface each time, and
the fast tier is the one budget you can't spend that way.

If the schema is generated from code, regenerate it in CI and fail on a
diff (CI.md rule 9), or the check compares two stale files.

Reserve a removed identifier (an enum value, a field number, an event
type, an operation name) for good. An old caller or an old message still
means the old thing by it.

## 3. Write behavior down as an executable spec

Behavior is checkable only when it's written as code that judges responses,
not asserts scattered across tests. A spec that maps (request, state) to the
correct responses can judge any build, including one it has never seen
(accordant skill). Hand-written asserts tied to today's implementation
can't be pointed at the next release. To write that spec, load the
"accordant" skill and follow its SPEC.md, then its BASELINE.md to run the
baseline against the new build.

The spec sees the system only through its API: requests in, responses and
published events out. It checks what a caller can observe; tables, internal
calls, and private state stay out of it. That boundary is what makes it a
compatibility check: callers depend on the API, so the API is what must not
change underneath them.

The spec and the sequences it generates are deterministic and replayable by
construction: the same build and the same inputs give the same verdict
every time. A spec that flips its verdict run to run cannot gate hundreds
of pull requests a day, because a red gate nobody can reproduce is a gate
people route around.

## 4. Ship the contract with the release

Put the schema, the spec, and the test sequences it generated into the
release, and list them in the manifest (PUBLISH.md rule 2). The next
release's checks then read the contract that actually shipped, not one
rebuilt from memory or from a tag that was patched later.

If the last release shipped no contract, make one: write the spec on main,
then run it against the last release's published artifact. Green means it
describes what users already have; freeze that as the baseline. Until a
release has shipped a contract, every change reports *baseline* (no
earlier contract to diff against) rather than *additive*, and the baseline
is real only from the release that ships the contract. Red means either the
spec is wrong or main already broke something, and you just found out
before the release did.

## 5. The released contract judges every build

On every pull request that can change behavior, run the last release's
suite (its spec, its sequences, its client) against the new build. Judge
the responses with the old spec: IDs, timestamps, and ordering
legitimately change, so a byte-for-byte match against recorded responses
fails on all of them. The spec knows which fields must
match and which only have to exist.

Decide "can change behavior" mechanically, without running the suite to
find out. A pull request can change behavior only if it touches the API
surface or any code the spec's requests can reach; every other pull request
skips the suite. Read "can reach" from an ownership map: a checked-in file
mapping each spec to the source paths its operations reach, generated from
the import graph or kept by hand, and checked in CI like any generated file
(CI.md rule 9). That filter
is what keeps the gate cheap enough to run on each of hundreds of pull
requests a day.

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
build (CI.md rule 7). To write the entry, load the "docs" skill and follow
its CHANGELOG.md. After the major release ships, its contract becomes the
new baseline.

Declaring a break is the user's call and a one-way door: it forces a major
version on everyone downstream, so the agent stops and asks: it shows the
failing check and the proposed changelog entry, then waits for a yes. Fixing the
change so the check passes again needs no permission.

Only that undeclared break is an error. Give every other result its own
level, so red keeps meaning "stop":

- **Undeclared break:** error; the build fails.
- **Declared break:** a notice, the fact the release notes must explain.
- **Promise reworded or removed, old contract still green:** a warning; a
  spec owner reviews the wording.
- **New promises only, or nothing changed:** silent.

Prefer deprecation to removal: keep the old behavior for at least one
release, warn when it's used, and say in the changelog when it goes away.

When an agent asks "is this a breaking change?" about a change it wrote
itself, run the review in a fresh context (a subagent where the harness has
one). A fresh context judges the diff instead of the intent behind it.
Before you start it, check that the baseline tag resolves and the diff is
non-empty, so bad input fails here and not inside the reviewer. Then paste
in everything it can't see for itself:

```text
Classify this change against release <tag>, layer by layer (COMPAT.md
rule 1). Inputs: the diff, <pasted>; the shape-diff output, <pasted or
"none">; the behavior-check output, <pasted or "none">.
For each change, report one line:
  <file:symbol> | shape or behavior | undeclared break, declared break,
  promise reworded, or new promise | the evidence (tool line or failing
  check)
End with the overall level, the highest one found. Under 300 words.
Report what the evidence shows. Where no check covers a change, say
"unchecked".
```

Report its lines as written, under the overall level.

## 7. Run the slow suites on a schedule, not on every pull request

Concurrency checks (do two simultaneous calls give a result some
one-at-a-time order explains?), fault injection (timeouts, lost
responses), and deeper exploration grow fast with every input. Run them
against main on a schedule and against the frozen commit before a release
(MONITOR.md rule 1, RELEASE.md rule 6), with the released contract as the
judge, just like rule 5. One green run proves little; read a failure that
comes and goes as CI.md rule 5 says.

## Done when

- The shape diff against the last release ran and its output is read
  (rule 2).
- The last release's suite ran against this build, judged by the old spec
  (rule 5).
- Every failure is fixed or declared. A declared break has the user's yes,
  a breaking changelog entry, and a migration note (rule 6).
- The release ships the schema, spec, and sequences, listed in its
  manifest (rule 4).
