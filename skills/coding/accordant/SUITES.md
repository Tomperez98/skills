# Scaling from one cluster to many suites

One spec is easy to keep honest. Ten are not: a case count doubles, a
nightly runs out of memory, and a suite nobody declared measures a graph the
product never runs. The unit you review is a **module**, the unit you
specify is a **cluster**, and the unit that runs is a **suite**. Apply the
rules in order.

## 1. Read the system as module → cluster → suite

A module is ownership and review. A cluster is one `Spec<State>` covering the
operations that share transitions. A suite is one exploration of that spec
from one state with one input set — the thing that produces cases, a budget,
an export, and traces.

One module may need several clusters; one cluster may need several suites.
Start a cluster at two to four related operations (SPEC.md rule 1), not when
a file gets long. A suite that covers the whole product is a scoping bug, and
splitting it is the fix, not a larger budget (rule 8).

## 2. Every operation has exactly one cluster owner

An operation belongs to exactly one cluster spec. A second spec may bind it
for compatibility or for a test-only scenario, but it owns no coverage.

- **A read-only surface is its own cluster.** Inside a write graph its reads
  become self-loops, and the case count becomes the product of the two
  surfaces. Run it at `MaxDepth = 2`: Accordant counts the initial state as
  depth 1, so depth 1 generates nothing, and a read-only graph yields one
  case per input.
- **A combined compatibility spec is not a module owner.** Hand-written,
  fault, concurrency, and test-only suites may use it. A generated cluster
  uses its cluster factory, and a test-only suite sets its coverage bit off.
- **Fault arms are setup, not operations.** An `Arm*` input enables a fault;
  arms are the only extra a binding may register (rule 4).
- **The transport registry and the spec must agree both ways.** Parse the
  routes, handlers, or subscriptions the system registers, and fail when one
  has no contract operation or a contract operation has no route. A manifest
  may index the mapping; it must not restate the behavior.

## 3. Declare each suite once

Every generated suite is one entry in a plan: the spec, the state it starts
from, its inputs, `ShouldApply`, its depth, its measured budget, and whether
it exports and owns coverage. The generated test, the budget gate, the
release export, and the trace fixture derive from that entry or assert
against it. None reconstructs its own state, inputs, or depth.

- A plan entry with no generated test is a gap.
- A test that passes its own state, inputs, or depth is drift, even when its
  case count happens to match.
- A new suite is one entry plus a test that calls it. Do not add another
  `--fixture` or `--budget` line to a task file.

## 4. Assert the binding before any case runs

A suite's binding registers exactly the contract operations the plan names,
plus its fault arms. Assert that before the first case runs, not after a
failure teaches you. A binding that registers extra operations measures a
graph the plan never declared.

## 5. Start each suite from the state it judges

The plan's state factory is both the spec's initial state and the service
seed. A generated suite starts from the state that matches its operations,
not the richest fixture. A smoke that starts somewhere else measures a graph
the suite never runs.

Keep that state lean: a field no `Apply` reads is cold data. Every transition
clones it, every node hashes it, and every trace serializes it. Put optional
read-model fields in nullable nested `[State]` objects, leave them null in the
lean fixture, and deep-clone them in every clone path (SPEC.md rule 3).
Extract by predicate use, not by database column.

## 6. Do not fork a cluster to protect a budget

A module that shares transitions with an existing cluster joins that
cluster's spec and plan entry. A parallel fixture that keeps an old budget is
a second graph nobody declared. Re-measure the suite and update its budget in
the same change.

Moving an operation between clusters moves its `Apply` body, its explanation
strings, and its outcome keys verbatim, and shared predicate helpers stay
shared. An empty diff of the explanation strings is the proof; a changed
string is a contract change (TRACES.md rule 9), not a refactor.

## 7. Measure, then set the budget

Run the exhaustive graph at the suite's own full depth and count the cases.
Set the budget from that count: measured + 15%, rounded up to the next 100,
with the measurement in a comment.

- A budget raised without a measured count hides a scoping regression. The
  guard firing is the expected result, not a reason to add an override.
- The budget bounds the **exhaustive** graph, not the pull request's random
  walk. A walk that produces fewer cases than a suite's exhaustive budget is
  a sample, not a regression.
- Do not add a global `--depth` or a per-entry `--budget` in a task file or
  CI. Each suite runs at the depth its plan declares.
- Run the stats, generate, and graph tasks only after their build dependency.
  Never invoke a smoke binary directly; the dependency is the stale-binary
  guard.

## 8. Growth or slowness is a scoping bug

A slow suite, an out-of-memory nightly, or a case count that doubles is a
scoping bug, not a budget problem. In order: split the cluster (rule 1),
remove cold state (rule 5), trim inputs to those aimed at a branch
(GENERATE.md rule 4), narrow derivations, then tighten the state space. Raise
the budget or the heap only after measuring the smaller model, and say why.

Do not widen a random walk to make a rare branch appear; add an aimed input
or a named manual case (GENERATE.md rule 7). The exhaustive graph, not the
walk length, is the coverage proof.

## 9. Run the same suite tasks locally and in CI

The suite's test, budget gate, export, and trace replay are tasks the local
gate and the workflow both call. A workflow task that is unreachable from the
local gate is a failure, and a narrower local variant is not the gate. When
the suite becomes the release contract, hand its export and baseline run to
BASELINE.md.

---

A suite that is not declared cannot be reviewed; a suite that is not measured
cannot tell a regression from a sample.

## Done when

- Every cluster has one `Spec<State>` and every suite one plan entry, and no
  test or task file reconstructs its state, inputs, or depth (rules 1, 3).
- Every exposed operation has one binding and one cluster owner, a read-only
  cluster runs at `MaxDepth = 2`, and a test-only suite owns no coverage
  (rules 2, 4).
- The suite starts from its plan's state and asserts its binding before any
  case runs (rules 4–5).
- The budget is the measured exhaustive count + 15%, rounded to the next 100,
  at the suite's own depth, with no override (rule 7).
- A suite that grew or slowed was fixed by scoping, and the local gate and CI
  run the same tasks (rules 8–9).
