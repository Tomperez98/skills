# Checking a new version against the last release

You're asking whether the new build still behaves the way the last release
promised. Accordant answers it without new asserts: the released spec judges
the new build's responses. The spec never compares responses byte for byte,
so IDs and timestamps can change and the check stays green.

What it judges is the system's API: the requests a caller sends, the
responses and published events it gets back. Nothing below reads a table
or watches an internal call — but data the old build wrote is judged
through the API that reads it (rule 7). With several services, each spec
covers its own service's public API; what that service calls is judged by
the provider's spec, not the caller's. Latency and throughput are out of
scope: a build that answers correctly but ten times slower passes. Apply
the rules in order.

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

Export the release's exact sequences at release time and ship the file
with the release. The rerun then replays what was tested, not whatever
today's generator produces from the old inputs, and a runner in another
language can execute it too (ORACLE.md rule 5). Put the header in the file
(ORACLE.md rule 3):

```csharp
public class ContractHeader : ITestingMetadata
{
    public string SpecVersion { get; set; }
    public bool FaultOutcomes { get; set; }
}

var header = new ContractHeader { SpecVersion = tag, FaultOutcomes = false };
TestCaseGenerator.SaveSequentialTestCases(context, header, "contract/sequential.json",
    spec.GenerateTests(new AppState(), inputs, gen));
TestCaseGenerator.SaveConcurrentTestCases(context, header, "contract/concurrent.json",
    spec.GenerateConcurrentTests(new AppState(), inputs, gen));
```

## 2. Point the old suite at the new build

Run the baseline's tests unchanged, with only the target swapped. Old
clients send old requests, so this is what they'll see after the upgrade.
Load the release's sequences rather than regenerating them:

```csharp
var context = baselineSpec.CreateTestingContext();
context.Register(new TodoApiClient(new HttpClient { BaseAddress = newBuildUrl }));
var (header, tests) = TestCaseGenerator.LoadSequentialTestCases<ContractHeader>(
    context, "contract/sequential.json");
var results = await baselineSpec.RunTests(context, new AppState(), tests, options);
```

- **A service** (HTTP, gRPC, a queue): register the baseline's client
  against the new build's address. `BeforeEachAsync` resets the new build
  the same way it reset the old one (GENERATE.md rule 3).
- **A library**: two runs, because consumers upgrade two ways. Rebuild the
  baseline test project against the new package — a compile error is a
  source break. Then run the baseline test assembly *as built at the
  release* with the new library's DLL swapped in — a failure only there is
  a binary break that recompiling hides (a changed `const` or default
  parameter value, a method moved to an extension, a return type the
  caller's source absorbs). Add the SDK's API compatibility check
  (`<EnablePackageValidation>true</EnablePackageValidation>` with
  `PackageValidationBaselineVersion` set to the release) for the shape
  breaks no test calls.
- **Another language**: execute `contract/sequential.json` against the new
  build, record the trace, and validate it with the baseline spec
  (ORACLE.md rule 3).

## 3. Make the old client as strict as the promise

The baseline judges what its binding hands it, not what went over the
wire. `System.Text.Json` is lenient by default: a field the new build
dropped deserializes to `null` or `0`, and a numeric enum value the old
build never had arrives as an undefined value — no error either way. If no
predicate checks that field, the break passes.

- Mark every promised field `[JsonRequired]` in the baseline's response
  types, and use `JsonStringEnumConverter` for enums: then a dropped field
  or an unknown enum value throws during deserialization, which the
  binding reports instead of hiding.
- Map the transport faithfully: the binding returns the real status code
  and body, not a wrapper that turns every 2xx into success.
- A promise the spec leaves out (SPEC.md rule 9) is a promise nobody
  checks. Callers depend on it anyway. Before a release, list the fields
  and status codes the API documents and confirm a predicate checks each
  one; an unchecked one is either added to the spec or declared
  unpromised in the docs.

## 4. A rejection is a break until someone decides otherwise

The failure message is the old rule the new build violated ("User 'ghost'
doesn't exist → 404", but the build answered 200). Either the new behavior
is a regression (fix the system) or it's a deliberate break (declare it in
the changelog and bump the major version — ship skill, COMPAT.md rule 6).
Never edit the baseline spec to make it pass: the baseline is what users
were promised, and changing it hides the break instead of declaring it.

## 5. Replay recorded traces under the new spec

The other direction catches a contract that changed by accident. Replay the
trace database (ORACLE.md rule 7) through main's spec: a trace the last
release produced that main's spec now rejects means the spec narrowed. If
that was deliberate, it's the same declared break as rule 4; if not, fix the
spec.

Record the events each service publishes as operations with a `Unit`
response (ORACLE.md rule 6) and keep them in the same database. Replaying
the last release's events under main's spec is the check that messages
already sitting in a queue will still be accepted after the deploy.

## 6. Tolerate additions — except to closed sets

A baseline that rejects every new field turns every additive change into a
false break. Check the fields the contract promised and say nothing about
the rest (SPEC.md rule 9): no "exactly these keys", no "list has exactly
three entries" unless three is the promise. A new optional field or a new
operation should leave the baseline green.

A value from a closed set is the exception. A new enum member, a new
status in a state machine, a new error code, a new event type: an old
client with an exhaustive `switch` or a fixed error table breaks on it,
even though nothing was removed. Write those predicates against the
released set (`r.Status is JobStatus.Pending or JobStatus.Completed`), so
the baseline rejects the new value and the decision goes through rule 4.
A set the docs say is open (new values may appear, clients must ignore
unknown ones) is checked like any other field.

## 7. Upgrade a system that already holds data

Every generated test starts from a reset system, so the baseline suite
never shows the new build data the old build wrote. That's where
migrations break. Drive this test yourself (the built-in runner resets
only between tests), with the `Check` helper and its profile threaded
through (ORACLE.md rule 2):

1. Start the last release and reset it. Run a sequence that builds up the
   state worth keeping — the release's exported sequences, or a
   `CreateManualSequentialTestCase` you name (GENERATE.md rule 7) —
   checking each response with the baseline spec.
2. Stop it and start the new build on the same storage. The upgrade is not
   an operation in the spec; the driver performs it between calls.
3. Keep calling — reads of everything created before, then writes — and
   judge each response with the same profile. An upgrade must leave
   everything a caller can observe unchanged, so the profile carries
   straight across it.

A call in flight while the service restarts can have taken effect or not:
declare it as an indefinite failure (FAULTS.md rule 2). Run this before
every release, and on a schedule with faults on (rule 8).

## 8. Run the slow suites on a schedule

Concurrent cases (CONCURRENCY.md) and fault-injected runs (FAULTS.md) cost
too much for every pull request. Run them on main on a schedule, repeatedly,
with both main's spec and the baseline's, and once more against the commit
you're about to release. A concurrent case that fails once in ten runs is a
race; keep it red until it's fixed. Keep the traces of passing runs in the
trace database (ORACLE.md rule 7): these suites hit the rare branches —
lost responses, interleavings — that no per-PR run ever records.

## 9. Several services: every spec, both directions

Rules 9–11 apply only when several services, each with its own spec, ship
together (ship skill, COMPAT.md rule 8). A single package skips to rule 12.

Each service keeps its own spec, and the check runs all of them. Backward:
every service's baseline suite runs against the new build (rule 2).
Forward: every service's suite on main runs against the last released
build, so a new consumer doesn't depend on behavior an old provider lacks.
A pull request that changes both sides of a contract passes at HEAD; only
these two runs show whether N-1 and N work side by side.

## 10. Test the rollout with every spec judging

Rule 7, across services: start every service at the last release, then
upgrade them one at a time in the scripted deploy order, with traffic
running throughout. Each service gets its own `Check` helper and profile,
and every profile carries across every upgrade — its own and its
neighbors'. Between two upgrades, N-1 and N run side by side for real.

## 11. Consumers check their fakes against the provider's spec

A consumer's tests usually replace the provider with a hand-written fake,
and the fake drifts. Run every response the fake returns through the
provider's spec with `spec.Allows` (ORACLE.md rule 1): a fake that answers
something the provider would never say fails the consumer's own build.
Then add the sequences the consumer actually relies on to the provider's
`InputSet`, labeled with the consumer's name, so the provider's CI runs
them and a failure names who would break.

## 12. Turn every spec run into review material

The ship skill routes review by contract change (CI.md rule 10).
Accordant produces each piece:

- **Promises that changed:** the explanation strings are the contract in
  words. Extract them from the spec source on main and on the branch and
  post the diff: `- "Cancel any order → 200"`, `+ "Order already shipped →
  409 on cancel"`. Interpolated strings diff as templates, which is what a
  reviewer wants. It's a hint, not the check: a predicate can tighten
  under an unchanged string, which only rules 2 and 5 catch.
- **States that changed:** render `spec.VisualizeStateSpace` with the same
  inputs on both sides and post the states and edges added or removed. "A
  shipped order can now be cancelled" shows up as a new edge, where a code
  diff hides it.
- **Which side moved:** run main's spec against the branch build (rule 2)
  and the branch's spec over main's trace database (rule 5), and post both
  results side by side.
- **Exact replay:** for each failing result, post its input labels in
  order, the explanation string, and the actual response as a `Check`
  sequence (DEBUG.md rule 2). The author pastes it into a test and has the
  failure in seconds.
- **Outcome coverage:** log the explanation from each branch of `Apply`
  during execution (`Logger.Log`, DEBUG.md rule 8), collect them in
  `AfterAll` (`info.Results` holds every result), and fail when an outcome
  in the source never ran. The fix is an input that reaches it
  (GENERATE.md rule 4) or a rule that should be deleted.

---

The checks reuse everything the other branches built: SPEC.md for the
contract, GENERATE.md for running it, ORACLE.md for traces and exported
plans. DEBUG.md still decides whether a red run is the spec's fault — but
here the baseline spec is fixed, so once setup is ruled out (DEBUG.md rules
5–6), a red run is the build's.
