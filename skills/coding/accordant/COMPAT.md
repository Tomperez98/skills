# Checking a new version against the last release

You're asking whether the new build still behaves the way the last release
promised. Accordant answers it without new asserts: the released spec judges
the new build's responses. The spec never compares responses byte for byte,
so IDs and timestamps can change and the check stays green.

What it judges is the system's API: the requests a caller sends, the
responses and published events it gets back. Nothing below reads a table
or watches an internal call. With several services, each spec covers its
own service's public API; what that service calls is judged by the
provider's spec, not the caller's. Apply the rules in order.

## 1. Keep the released suite runnable

No suite in the last release? Write the spec on main and run it against
the last release's published artifact first. If it's green, that spec
describes what shipped: tag it as the baseline and carry on from here.

Expect the first runs to find the spec wrong more often than the system:
guards in a different order, edge rules nobody told you. Read the API's
docstrings and reference docs for those rules before writing predicates
(an empty environment variable that counts as unset is a documented rule,
not a bug), and treat each rejection with DEBUG.md rule 4. Every fix is a
rule the spec now knows.

The baseline is the last release's spec, bindings, and `InputSet`: its
whole test project at the release tag. Check it out next to main rather
than copying it, so nobody edits the baseline by accident. Match the
release tag pattern explicitly: a bare `git describe --tags` returns
whatever tag is nearest, and in a repo with several services that can be
one service's own tag.

```bash
# The latest release at or before HEAD; a release build skips HEAD's own tag
# and takes the one before (ship skill, COMPAT.md rule 5).
tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' HEAD)
git worktree add ../baseline "$tag"
```

With services in lockstep, that one worktree holds every service's
baseline suite.

If a runner in another language executes the sequences, also export them at
release time (ORACLE.md rule 5) and ship the file with the release:

```csharp
var tests = spec.GenerateTests(new AppState(), inputs, gen);
TestCaseGenerator.SaveSequentialTestCases(context, "contract/sequential.json", tests);
var concurrent = spec.GenerateConcurrentTests(new AppState(), inputs, gen);
TestCaseGenerator.SaveConcurrentTestCases(context, "contract/concurrent.json", concurrent);
```

## 2. Point the old suite at the new build

Run the baseline's tests unchanged, with only the target swapped. Old
clients send old requests, so this is what they'll see after the upgrade.

- **A service** (HTTP, gRPC, a queue): register the baseline's client
  against the new build's address. `BeforeEachAsync` resets the new build
  the same way it reset the old one (GENERATE.md rule 3).
- **A library**: build the baseline test project against the new package
  version. A compile error there is a shape break, the same one an API diff
  reports.
- **Exported sequences**: execute `contract/sequential.json` against the new build,
  record the trace, and validate it with the baseline spec (ORACLE.md rule
  3).

```csharp
var context = baselineSpec.CreateTestingContext();
context.Register(new TodoApiClient(new HttpClient { BaseAddress = newBuildUrl }));
var results = await baselineSpec.RunTests(context, new AppState(), tests, options);
```

## 3. A rejection is a break until someone decides otherwise

The failure message is the old rule the new build violated ("User 'ghost'
doesn't exist → 404", but the build answered 200). Either the new behavior
is a regression (fix the system) or it's a deliberate break (declare it in
the changelog and bump the major version — ship skill, COMPAT.md rule 6).
Never edit the baseline spec to make it pass: the baseline is what users
were promised, and changing it hides the break instead of declaring it.

## 4. Replay recorded traces under the new spec

The other direction catches a contract that changed by accident. Replay the
trace database (ORACLE.md rule 7) through main's spec: a trace the last
release produced that main's spec now rejects means the spec narrowed. If
that was deliberate, it's the same declared break as rule 3; if not, fix the
spec.

Record the events each service publishes as operations with a `Unit`
response (ORACLE.md rule 6) and keep them in the same database. Replaying
the last release's events under main's spec is the check that messages
already sitting in a queue will still be accepted after the deploy.

## 5. Write predicates that tolerate additions

A baseline that rejects every new field turns every additive change into a
false break. Check the fields the contract promised and say nothing about
the rest (SPEC.md rule 9): no "exactly these keys", no "list has exactly
three entries" unless three is the promise. A new optional field or a new
operation should leave the baseline green.

## 6. Run the slow suites on a schedule

Concurrent cases (CONCURRENCY.md) and fault-injected runs (FAULTS.md) cost
too much for every pull request. Run them on main on a schedule, repeatedly,
with both main's spec and the baseline's, and once more against the commit
you're about to release. A concurrent case that fails once in ten runs is a
race; keep it red until it's fixed.

## 7. Several services: every spec, both directions

Rules 7–9 apply only when several services, each with its own spec, ship
together (ship skill, COMPAT.md rule 8). A single package skips to rule 10.

Each service keeps its own spec, and the check runs all of them. Backward:
every service's baseline suite runs against the new build (rule 2).
Forward: every service's suite on main runs against the last released
build, so a new consumer doesn't depend on behavior an old provider lacks.
A pull request that changes both sides of a contract passes at HEAD; only
these two runs show whether N-1 and N work side by side.

## 8. Test the rollout with every spec judging

Start every service at the last release, then upgrade them one at a time
in the scripted deploy order, with traffic running throughout. The upgrade
is not an operation in any spec: no service exposes "upgrade" in its API.
The test driver performs it between calls, and the specs judge only the
API calls around it. The built-in runner resets only between tests, so
drive this one yourself, with a `Check` helper per service and its own
profile threaded through (ORACLE.md rule 2).

An upgrade must leave everything a caller can observe unchanged, so each
profile carries straight across it: a response after the upgrade is judged
against the state built up before it. A call in flight while a service
restarts can have taken effect or not, so declare it as an indefinite
failure (FAULTS.md rule 2). Run it before every release and on a schedule
with faults on (rule 6).

## 9. Consumers check their fakes against the provider's spec

A consumer's tests usually replace the provider with a hand-written fake,
and the fake drifts. Run every response the fake returns through the
provider's spec with `spec.Allows` (ORACLE.md rule 1): a fake that answers
something the provider would never say fails the consumer's own build.
Then add the sequences the consumer actually relies on to the provider's
`InputSet`, labeled with the consumer's name, so the provider's CI runs
them and a failure names who would break.

## 10. Turn every spec run into review material

The ship skill routes review by contract change (CI.md rule 10).
Accordant produces each piece:

- **Promises that changed:** the explanation strings are the contract in
  words. Extract them from the spec source on main and on the branch and
  post the diff: `- "Cancel any order → 200"`, `+ "Order already shipped →
  409 on cancel"`. Interpolated strings diff as templates, which is what a
  reviewer wants.
- **States that changed:** render `spec.VisualizeStateSpace` with the same
  inputs on both sides and post the states and edges added or removed. "A
  shipped order can now be cancelled" shows up as a new edge, where a code
  diff hides it.
- **Which side moved:** run main's spec against the branch build (rule 2)
  and the branch's spec over main's trace database (rule 4), and post both
  results side by side.
- **Exact replay:** for each failing result, post its input labels in
  order, the explanation string, and the actual response as a `Check`
  sequence (DEBUG.md rule 2). The author pastes it into a test and has the
  failure in seconds.
- **Outcome coverage:** log the explanation from each branch of `Apply`
  during execution (`Logger.Log`, DEBUG.md rule 8), and fail when an
  outcome in the source never ran. The fix is an input that reaches it
  (GENERATE.md rule 4) or a rule that should be deleted.

---

The checks reuse everything the other branches built: SPEC.md for the
contract, GENERATE.md for running it, ORACLE.md for traces and exported
plans. DEBUG.md still decides whether a red run is the spec's fault — but
here the baseline spec is fixed, so once setup is ruled out (DEBUG.md rules
5–6), a red run is the build's.
