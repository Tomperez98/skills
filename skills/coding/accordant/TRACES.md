# Testing the spec itself

The spec judges the system; something has to judge the spec. You're
changing a rule, reviewing someone's spec change, or wondering whether the
spec would notice a wrong answer at all. The evidence is a set of traces —
what the system really did — replayed through the spec alone, with no
system running. Apply the rules in order.

## 1. Two corpora, two jobs

- **Traces** hold what the system did: each call's operation, request, and
  response. Replay judges them with the spec alone (ORACLE.md rule 3), so
  they catch a *spec* that changed.
- **Test plans** hold only what to call (ORACLE.md rule 5). Running them
  again against a build catches a *system* that changed (BASELINE.md).

When a spec change turns a run red, replay the traces before blaming the
system: a trace that used to pass and now fails is a spec regression until
proven otherwise. A failing generated sequence belongs with the test plans,
not in the trace database — a trace is only evidence once the spec has
accepted it.

## 2. Record traces from passing runs

Start a trace when a test starts, append each step, and keep it only if
the test passed:

```csharp
var traces = new List<Trace>();
Trace current = null;

var json = new JsonSerializerOptions { IncludeFields = true }; // tuple requests
string Record(object value) => value is Exception e
    ? JsonSerializer.Serialize(new { Exception = e.GetType().Name, e.Message })
    : JsonSerializer.Serialize(value, json);

var options = new TestExecutionOptions
{
    BeforeEach = info => current = new Trace(Header: header, Case: info.TestCase.Description),
    OnStepExecuted = step => current.Segments.Add(step.Operations
        .Select(o => new TraceStep(o.Operation.Name, Record(o.Request), Record(o.Response)))
        .ToList()),
    AfterEach = info => { if (info.Success) traces.Add(current); },
};
```

Each sync hook runs only when its async twin is unset. If the options
already reset in `BeforeEachAsync` (GENERATE.md rule 3), `BeforeEach`
never runs, `current` stays null, and every test fails — start the trace
inside `BeforeEachAsync` instead, and likewise use `OnStepExecutedAsync`
if it's set. Two serialization traps the `Record` helper covers: default
options skip fields, so a tuple request records as `{}`; and an
`Expect.Throws` response is the exception itself, which `System.Text.Json`
can't serialize — the throw fails a passing test.

`Trace` and `TraceStep` are your own records. Each `OnStepExecuted` call
is one segment: a single call, a polling call, or a concurrent batch that
replays through `AllowsConcurrent` (ORACLE.md rule 4). Record raw
requests and responses, with the header ORACLE.md rule 3 describes. A
system outside .NET records the same shape itself.

Two gaps in what the hook sees:

- **Polls after a concurrent group** run without the hook, so the trace
  misses them and replays to a different profile. Don't keep traces from
  concurrent cases whose group starts background work.
- **Retries** (FAULTS.md rule 8) fire the hook once per attempt, but the
  runner judges each attempt from the profile before the first (in a
  concurrent batch, only the retried calls rerun, from the profile after
  the batch). Replay
  steps through every attempt instead; with retried responses declared
  `.SameState()` the verdict matches, but keep such traces out of the
  ambiguity bound (rule 6).

## 3. Store traces outside the repo; commit a manifest

Never commit the traces: they grow with every run, and git keeps every version
forever. Store them outside the repo — attached to the release with the rest of
the contract (ship skill, COMPAT.md rule 4), or in an artifact store keyed by
release — and commit only a manifest: one line per trace with its location,
checksum, header, coverage tags (rule 4), and the candidate count its first
replay ended with (rule 6). CI fetches what the manifest names, checks every
checksum, and replays; a trace that's missing or doesn't match its checksum
fails the build instead of being skipped.

## 4. Keep by coverage, not volume

A non-deterministic system doesn't make the database flaky: replay never
calls the system, so the same trace always gets the same verdict. It does
make every trace a sample — a run that saw `Completed` says nothing about
the spec's `Failed` branch.

Keep at least one trace per operation and outcome, including passing runs
from the scheduled fault and concurrent suites (BASELINE.md rule 8).
`Allows` doesn't report which outcome matched, so tag each trace with the
generated case it came from (`info.TestCase`; each case is a path through
the spec's graph) or, for a trace from another language, with each step's
operation and kind of response (status, error type). Report coverage that
drops after a change.

Keep the set small rather than the storage cheap: a prefix of an accepted
trace is still accepted, so cut each trace after the last step that adds
coverage, and drop a trace whose tags another one already covers.

## 5. Replay on every spec change; never overwrite a rare branch

Replay the whole database in CI on every change to the spec. When a trace
fails because the behavior changed on purpose, re-record only the traces
the spec now rejects, move the old ones to a rejected set the spec must
keep rejecting, and say so in the commit. Re-recording everything trades
the lost response you saw once for a run that didn't hit it.

A trace that no longer deserializes into the spec's types is a changed
request or response type, not a rejection — a shape break to declare
(BASELINE.md rule 4), not a rule to loosen.

## 6. Bound the ambiguity

Replay can pass while the spec gets vaguer. Record the candidate count
(`profile.StatesAndStepFunctions.Count`) a trace ends with on its first
replay — after any cut (rule 4), since a shorter trace ends elsewhere —
then compare each later replay's count with the one the
manifest recorded, and fail a replay that ends with more: a read that
stopped narrowing (ASYNC.md rule 3) is a regression too.

## 7. Mutate traces to prove the spec rejects wrong answers

The database only catches a spec that got stricter; a spec that accepts
everything passes it too. Take recorded traces, change one response field
per copy — a status code, an amount, an ID, a `Pending` that should be
`Completed` — and assert the spec rejects every copy. Mutate into a wrong
answer, not into another explanation the spec declares: a success turned
into a timeout is rightly accepted while failure outcomes are on
(FAULTS.md rule 2), and a change to a field the contract never promised is
rightly ignored (SPEC.md rule 9). A mutant that passes otherwise is a
predicate that doesn't check what it should (SPEC.md rule 7); strengthen
it, or note why that field is not part of the contract.

## 8. Every outcome in the source must run

Record each outcome as it matches, and fail when an outcome in the source
never matched. Recording where `Apply` builds an outcome over-counts:
`Expect.OneOf` builds every outcome it lists, so both timeout worlds would
count as run. Record inside `ThenState` instead, which runs only for a
matched outcome, and give a `.SameState()` outcome you need to count a
`ThenState` that changes nothing. `Apply` also runs during generation and when
the runner explains a rejection, so gate the recording with a flag you set only
around `RunTests` (the `AsyncLocal` pattern of FAULTS.md rule 6) and measure on
green runs. Check in `AfterAll`, and count only the cases that ran —
`info.Results` leaves out the ones `StopOnFirstFailure` skipped. The fix is an
input that reaches it (GENERATE.md rule 4) or a rule that should be deleted.

## 9. Post a spec change as a contract change

The ship skill routes review by contract change (CI.md rule 10). A spec
change produces each piece:

- **Promises that changed:** the explanation strings are the contract in
  words. Extract them from the spec source on main and on the branch and
  post the diff: `- "Cancel any order → 200"`, `+ "Order already shipped →
  409 on cancel"`. Interpolated strings diff as templates, which is what a
  reviewer wants. It's a hint, not the check: a predicate can tighten
  under an unchanged string, which only replay (rule 5) and the baseline
  run (BASELINE.md rule 2) catch.
- **States that changed:** render `spec.VisualizeStateSpace` with the same
  inputs on both sides and post the states and edges added or removed. "A
  shipped order can now be cancelled" shows up as a new edge, where a code
  diff hides it.
- **Which side moved:** run main's spec against the branch build
  (BASELINE.md rule 2) and the branch's spec over main's trace database
  (rule 5), and post both results side by side.
- **Exact replay:** for each failing result, post its input labels in
  order, the explanation string, and the actual response as a `Check`
  sequence (DEBUG.md rule 2). The author pastes it into a test and has the
  failure in seconds.

When an agent wrote the spec change and is also asked to review it, run
the review in a subagent. A fresh context reads the four pieces instead of
the intent behind them. Produce the pieces first. A review started without
the replay results has nothing to judge. Then paste them in:

```text
Review this spec change as a contract change. Inputs: the explanation-
string diff, <pasted>; the state and edge diff, <pasted>; main's spec on
the branch build and the branch's spec on main's traces, <pasted>.
For each changed promise, report one line:
  <explanation string> | added, removed, tightened, or loosened |
  intended? yes, no, or ask | the evidence (diff line or replay result)
End with the replay results, both sides as given. Under 300 words.
Mark "ask" wherever the evidence can't tell intent; never guess.
```

Post its lines as written beside the four pieces. An "ask" goes to the
spec's owner, not back to the author's agent.

## Done when

- Only traces from passing runs are kept, each with its header (rule 2)
  and coverage tags (rule 4).
- The repo holds a manifest, not traces, and CI fails on a trace that is
  missing or doesn't match its checksum (rule 3).
- CI replays the whole database on every spec change and fails a replay
  that ends with more candidates than the manifest recorded (rules 5–6).
- Every mutated copy of a trace is rejected, or the field is noted as
  outside the contract (rule 7).
- Every outcome in the source matched at least once on a green run
  (rule 8).

---

A trace that fails replay goes through DEBUG.md rule 4 like any other
rejection. Checking the system, not the spec, against the last release is
BASELINE.md.
