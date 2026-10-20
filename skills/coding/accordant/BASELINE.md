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

No suite in the last release? Make one and freeze it as the baseline
(ship skill, COMPAT.md rule 4).

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
whatever tag is nearest, which can be a prerelease or an unrelated tag.
`--match` is a glob, so `v[0-9]*` also matches `v1.2.0-rc.1`; exclude
prereleases too.

```bash
# The latest release reachable from HEAD, HEAD's own tag included.
tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD)
# A release build is judged against the release before it (ship skill,
# COMPAT.md rule 5): start from HEAD^ so HEAD's own tag is skipped.
# tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD^)
git worktree add ../baseline "$tag"
```

With services in lockstep, that one worktree holds every service's
baseline suite.

Export the release's exact sequences at release time and ship the file
with the release. The rerun then replays what was tested, not whatever
today's generator produces from the old inputs, and a runner in another
language can execute it too (ORACLE.md rule 5). The file serializes each
request with default `System.Text.Json` options, which skip fields: a tuple
request like `(string, int)` is saved as `{}` and loads back as `(null, 0)`,
with no error. Give every operation a record or class request before you
export. Put the header in the file (ORACLE.md rule 3):

```csharp
public class ContractHeader : ITestingMetadata
{
    public string SpecVersion { get; set; }
    public bool FaultOutcomes { get; set; }
}

var header = new ContractHeader { SpecVersion = releaseTag, FaultOutcomes = false };
TestCaseGenerator.SaveSequentialTestCases(context, header, "contract/sequential.json",
    spec.GenerateTests(new AppState(), inputs, gen));
TestCaseGenerator.SaveConcurrentTestCases(context, header, "contract/concurrent.json",
    spec.GenerateConcurrentTests(new AppState(), inputs, gen));
```

## 2. Point the old suite at the new build

Run the baseline's tests unchanged, with only the target swapped. Old
clients send old requests, so this is what they'll see after the upgrade.
Run it on the pull requests that can change behavior, not on every pull
request (ship skill, COMPAT.md rule 5), so the baseline stays in the fast
tier. Load the release's sequences rather than regenerating them:

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
  a binary break that recompiling hides. A method moved to an extension,
  or a return type the caller's source absorbed, throws
  `MissingMethodException`. A changed `const` or default parameter value
  throws nothing — the old caller keeps the old value — so it shows up
  only where a predicate depends on it. Keep the release's compiled test
  output as a release artifact for this run; the swapped DLL needs an
  assembly version at least the old one, and a dependency new in this
  version must be copied in too. Add the SDK's API compatibility check
  (`<EnablePackageValidation>true</EnablePackageValidation>` with
  `PackageValidationBaselineVersion` set to the release) for the shape
  breaks no test calls; it runs on `dotnet pack`, so pack in CI.
- **Another language**: execute `contract/sequential.json` against the new
  build, record the trace, and validate it with the baseline spec
  (ORACLE.md rule 3).

## 3. Make the old client as strict as the promise

The baseline judges what its binding hands it, not what went over the
wire. `System.Text.Json` is lenient by default: a field the new build
dropped deserializes to `null` or `0`, and a numeric enum value the old
build never had arrives as an undefined value — no error either way. If no
predicate checks that field, the break passes.

- Make the baseline's deserializer reject what the promise rules out:
  mark every promised field `[JsonRequired]` (a dropped field throws), set
  `RespectNullableAnnotations = true` (a non-nullable field sent as `null`
  throws). For enums sent as names, add `new
  JsonStringEnumConverter(allowIntegerValues: false)` — an unknown name
  or any number throws. For enums sent as numbers that converter rejects
  every value, valid ones too; check `Enum.IsDefined` in the binding
  instead. The binding then reports the break instead of hiding it.
- Map the transport faithfully: the binding returns the real status code
  and body, not a wrapper that turns every 2xx into success.
- A promise the spec leaves out (SPEC.md rule 10) is a promise nobody
  checks. Callers depend on it anyway. Before a release, list the fields
  and status codes the API documents and confirm a predicate checks each
  one; an unchecked one is either added to the spec or declared
  unpromised in the docs.

## 4. A rejection is a break until someone decides otherwise

The failure message is the old rule the new build violated ("User 'ghost'
doesn't exist → 404", but the build answered 200). Either the new behavior
is a regression (fix the system) or it's a deliberate break (declare it:
call the Skill tool with "ship" and follow its COMPAT.md rule 6).
Never edit the baseline spec to make it pass: the baseline is what users
were promised, and changing it hides the break instead of declaring it.

## 5. Replay recorded traces under the new spec

The other direction catches a contract that changed by accident. Replay the
trace database (TRACES.md) through main's spec: a trace the last
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
the rest (SPEC.md rule 10); assert a list's length only when three is the
promise, and leave "exactly these keys" out. A new optional field or a new
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
migrations break. The runner resets only between tests, so one test can
span the upgrade:

1. Write one sequence that builds up the state worth keeping, then reads
   all of it back, then writes again — a `CreateManualSequentialTestCase`
   over labels (GENERATE.md rule 7). A label can appear once per case, so
   give the post-upgrade reads their own inputs (`"Get alice after
   upgrade"`).
2. Start the last release, reset it, and run the case with the baseline
   spec. After the last pre-upgrade step, `OnStepExecutedAsync` stops the
   release, starts the new build on the same storage, and registers a
   client for it (`info.Context.Register(…)` replaces the old one).
3. The runner keeps judging with the same profile: an upgrade must leave
   everything a caller can observe unchanged, so the state built before
   it is what the new build must answer from.

```csharp
var steps = 0;
var options = new TestExecutionOptions
{
    OnStepExecutedAsync = async info =>
    {
        if (++steps != upgradeAfter) return;
        await deployment.UpgradeToNewBuildAsync();          // same storage
        info.Context.Register(new TodoApiClient(newBuildHttpClient));
    },
};
```

Count only the steps you wrote: a polled input fires the hook again for
its polling calls, so keep the case unpolled or count by operation. Run
this before every release, and on a schedule with faults on (rule 8).

## 8. Run the slow suites on a schedule

Concurrent cases (CONCURRENCY.md) and fault-injected runs (FAULTS.md) cost
too much for every pull request. Run them on main on a schedule, repeatedly,
with both main's spec and the baseline's (ship skill, COMPAT.md rule 7).
A concurrent case that fails once in ten runs is a race; keep it red until
it's fixed. Keep the traces of passing runs in the
trace database (TRACES.md rule 4): these suites hit the rare branches —
lost responses, interleavings — that no per-PR run ever records.

## 9. Several services: every spec, both directions

Rules 9–11 apply only when several services, each with its own spec, ship
together (ship skill, COMPAT.md rule 8). A single package stops at rule 8.

Each service keeps its own spec, and the check runs all of them, both
directions (ship skill, COMPAT.md rule 9). Backward: every service's
baseline suite runs against the new build (rule 2). Forward: every
service's suite on main runs against the last released build.

## 10. Test the rollout with every spec judging

Rule 7, across services, in the scripted deploy order (ship skill, COMPAT.md
rule 10). Drive this one yourself: each service gets its own `Check` helper and
profile (ORACLE.md rule 2), and every profile carries across every upgrade — its
own and its neighbors'. Between two upgrades, N-1 and N run side by side for
real. A call in flight while a service restarts can have taken effect or not:
declare it as an indefinite failure (FAULTS.md rule 2).

## 11. Consumers check their fakes against the provider's spec

A consumer's tests usually replace the provider with a hand-written fake,
and the fake drifts. Run every response the fake returns through the
provider's spec with `spec.Allows` (ORACLE.md rule 1): a fake that answers
something the provider would never say fails the consumer's own build.
Then add the calls the consumer relies on to the provider's `InputSet`,
labeled with the consumer's name (`"Billing: cancel shipped order"`), and
the sequences as manual cases over those labels (GENERATE.md rule 7), so
the provider's CI runs them and a failure names who would break.

---

The checks reuse everything the other branches built: SPEC.md for the contract,
GENERATE.md for running it, ORACLE.md for traces and exported plans, TRACES.md
for the trace database and for reviewing the spec diff that declares a break.
DEBUG.md still decides whether a red run is the spec's fault — but here the
baseline spec is fixed, so once setup is ruled out (DEBUG.md rules 5–6), a red
run is the build's.

## Done when

- The baseline suite is checked out at the last release tag, matched with
  prereleases excluded, not copied onto main (rule 1).
- The release's exported sequences ran unchanged against the new build,
  and every rejection ended as a fix to the system or a declared break, with
  the baseline spec unedited (rule 2, rule 4).
- The baseline's deserializer rejects a dropped field and an unknown enum
  value (rule 3).
- An upgrade case runs the last release and then the new build on the same
  storage, inside one test (rule 7).
- With several services: every service's baseline ran against the new
  build, and every main suite against the last release (rule 9).
