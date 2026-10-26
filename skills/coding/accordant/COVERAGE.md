# Checking what a green suite would catch

The suite is green (GENERATE.md). Green says the system agreed with the spec
on the sequences you ran, not that those sequences reach every rule or would
catch a bug. The sequences come from walking the spec's graph before anything
runs, so nothing in generation is coverage-guided. Apply the rules in order.

## 1. Audit the inputs with code coverage

Run generation under a coverage tool. A branch of `Apply` that never runs is
an input you're missing (GENERATE.md rule 4). Then run the suite under the
system's coverage tool: a branch of the system that never runs is a missing
input, or a rule the spec doesn't know (ask the owner, as DEBUG.md rule 4
does).

A system with no state (a parser, a pure function) gives a graph of one node
with a self-loop per input; `StateCoverage` turns each self-loop into a
one-call case, so every input runs exactly once. For such a system this audit
is the whole job: rules 2–4 add nothing.

## 2. Walk cycles with a custom algorithm

No built-in algorithm goes around a cycle (GENERATE.md rule 7): once a case is
back in a state it has seen, it can't leave by the same edge again. Re-creating
after a delete is where stale tombstones, leftover indexes, and reused IDs
break. A custom walk that may retake edges covers it. The delegate is
`(TestingContext context, StateGraphNode root) => IList<SequentialTestCase>`.
The runner rejects a repeated call name, so clone each call and make its name
unique, and turn off name simplification, which would strip the suffix:

```csharp
SequentialTestCaseAlgorithm CyclingWalk(int walks, int length, int seed) => (ctx, root) =>
{
    var rng = new Random(seed);
    var cases = new List<SequentialTestCase>();
    for (var w = 0; w < walks; w++)
    {
        var calls = new List<OperationCall>();
        for (var (node, i) = (root, 0); i < length && node.Edges.Count > 0; i++)
        {
            // Reads and refusals are self-loops; favor edges that move, or
            // most walks never leave the initial state.
            var moving = node.Edges.Where(e => e.Target != node).ToList();
            var pool = moving.Count > 0 && rng.NextDouble() < 0.7 ? moving : node.Edges;
            var edge = pool[rng.Next(pool.Count)];
            var call = ((OperationCall)edge.Metadata).Clone();
            call.Name = $"{call.Name} #{i}";
            calls.Add(call);
            node = edge.Target;
        }
        cases.Add(new SequentialTestCase
        {
            Description = TestCaseGenerator.ConstructDescriptionForSequentialTestCase(calls),
            OperationCalls = calls,
        });
    }
    return cases;
};

var gen = new TestGenerationOptions
{
    MaxDepth = -1,
    StateConstraint = s => ((AppState)s).Users.Count <= 2,
    SimplifyOperationCallNames = false,
    SequentialTestCaseAlgorithm = CyclingWalk(walks: 200, length: 12, seed: 42),
};
```

The runner links a derived call to its source by name, so check a walk over
derived requests (GENERATE.md rule 9) against a real run first.

## 3. Reach deep states with a swarm

Run several generations, each with a random subset of inputs switched off
through `ShouldApply` (`(input, state) => enabled.Contains(input.Name)`).
Delete keeps a queue from ever filling and Cancel keeps a quota from running
out; a run without them gets there.

## 4. Prove each rule's sequence runs

In a spec where most inputs are reads or refusals, an unweighted walk spends
nearly every step on self-loops, so a rule that needs an issue created,
closed, then closed again stays untested while the run is green (the 70% bias
toward moving edges in rule 2 fixed it). For each such rule, count the
generated cases that contain the sequence it needs, or plant a bug in that
rule and see the suite fail (rule 5).

Make a missing sequence appear with an input aimed at it (GENERATE.md rule 4)
or a named manual case (GENERATE.md rule 7), and keep the number of walks and
the walk length as they are. The exhaustive graph, not the walk length, is
the coverage proof.

## 5. Measure the suite by the bugs it catches

Mutation testing measures directly whether the suite catches a bug: run it
against the system with small bugs planted in it — Stryker.NET for .NET, or
the mutation tool of the system's language — and read each surviving mutant.
It is one of three gaps: an input that never reaches the code (GENERATE.md
rule 4), a change no read observes (GENERATE.md rule 4), or a predicate that
doesn't check the field (SPEC.md rule 8). TRACES.md rule 7 does the same for
the spec. Run it on the cluster you just specified, not the whole system, and
on a schedule rather than every push — it reruns the suite once per mutant.

## Done when

- Generation and the suite ran under a coverage tool, and every `Apply` branch
  that never ran has an input aimed at it or is deleted (rule 1).
- Every rule that depends on re-creating or revisiting state runs in a
  cycling-walk case (rule 2).
- Every rule that needs a deep sequence appears in at least one generated
  case, or a bug planted in it fails the suite (rule 4).
- Every surviving mutant is traced to one of the three gaps and closed, or
  noted as outside the contract (rule 5).
