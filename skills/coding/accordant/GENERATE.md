# Generating and running tests

The spec exists (SPEC.md). Now connect it to the real system, let Accordant
explore the state graph from a few sample inputs, and run the sequences it
extracts. Every response is judged by the spec; the test asserts only that
no result failed. Apply the rules in order.

## 1. Bind every operation with its exact types

`Apply` says what should happen; the binding makes it happen. The name and
the `<TRequest, TResponse>` pair must match the operation exactly, or
execution fails with a missing binding or a cast error. Bind async APIs with
`BindAsync` — `.Result` inside `Bind` can deadlock.

```csharp
spec.ExecuteWith<TodoApiClient>()
    .BindAsync<User, ApiResult<User>>("CreateUser",
        (c, req) => c.CreateUserAsync(req.UserId, req.Name))
    .BindAsync<string, ApiResult<User>>("GetUser",
        (c, id) => c.GetUserAsync(id))
    .BindAsync<string, Unit>("DeleteUser", async (c, id) =>
    {
        await c.DeleteUserAsync(id);
        return Unit.Value;
    });
```

Class-based operations override `ExecuteAsync(TestingContext context,
TRequest request)` instead and fetch their client with
`context.Get<T>()`. Reuse the client and server setup the project's
existing integration tests use (`WebApplicationFactory`, a container,
an in-process instance).

## 2. Register the target in a testing context

The runner resolves bound targets from a `TestingContext`:

```csharp
var context = spec.CreateTestingContext();
context.Register(new TodoApiClient(factory.CreateClient()));
```

Call `spec.WithJsonPrinters()` when you build the spec so requests and
responses print as JSON in failure logs.

## 3. Reset the system to the spec's initial state before every test

Each generated test starts from the `initialState` you pass — usually
`new AppState()`. The system has to actually be there, or the first
response is judged against the wrong world. Reset in `BeforeEachAsync`,
in the order of preference: recreate the resource (fresh database or
container), delete every ID the inputs can create, or isolate each test
with unique names.

```csharp
var options = new TestExecutionOptions
{
    BeforeEachAsync = async info =>
    {
        var c = info.Context.Get<TodoApiClient>();
        foreach (var id in new[] { "alice", "bob" })
            await c.DeleteUserAsync(id);
    },
};
```

## 4. Few inputs, each aimed at a branch

An `InputSet` is the menu of concrete calls the explorer may try in any
order. Pick inputs so every guard in the spec can fire: a valid ID, an ID
that never exists, a second Create for the duplicate path, an amount above
and below the balance. Label every input — the labels become the test-case
names.

```csharp
var createUser = spec.GetOperation<User, ApiResult<User>>("CreateUser");
var getUser = spec.GetOperation<string, ApiResult<User>>("GetUser");

var inputs = new InputSet
{
    createUser.With(new User("alice", "Alice"), "Create alice"),
    getUser.With("alice", "Get alice"),
    getUser.With("ghost", "Get ghost"),
};
```

A `Unit`-request operation takes just a label: `pop.With("Pop")`. Five or
six inputs routinely yield dozens of sequences; add inputs only when a
branch isn't covered.

## 5. Bound the graph before it bounds you

Exploration applies every input in every reachable state, so the graph can
grow exponentially. `TestGenerationOptions` bounds it:

- `MaxDepth` (default 5) — the longest sequence explored; `-1` is unbounded
  and never terminates on an unbounded state (a counter).
- `StateConstraint` — stop exploring past states you don't care about.
- `ShouldApply` — skip an input in states where it makes no sense.
- `MaxOperationApplicationCount` — reuse each input at most N times per path.

```csharp
var gen = new TestGenerationOptions
{
    MaxDepth = 4,
    StateConstraint = s => ((AppState)s).Users.Count <= 2,
};
```

The lambdas receive `IState`; cast to your state type.

## 6. Look at the graph, and prove the spec runs, before touching the system

Generation runs only `Apply`, so it needs no server. Two cheap checks
before the first real run:

```csharp
// Does the spec crash anywhere reachable? (KeyNotFound, null, bad index)
Assert.That(spec.GenerateTests(new AppState(), inputs, gen), Is.Not.Empty);

// Does the graph match your mental model?
File.WriteAllText("graph.dot", spec.VisualizeStateSpace(new AppState(), inputs, gen));
// dot -Tsvg graph.dot -o graph.svg
```

Self-loops are reads and refusals; edges are state changes. A missing edge
is a rule you forgot; a state you didn't expect is a rule you got wrong.
For big graphs, pass `new VisualizationOptions { NodeLabelLambda = … }` or
`UseCountBasedNodeLabels = true`.

## 7. Choose how sequences are cut from the graph

`SequentialTestCaseAlgorithm` decides which paths become tests:

- `SequentialTestCaseAlgorithms.StateCoverage` (default) — every state at
  least once.
- `SequentialTestCaseAlgorithms.CreateTransitionCoverage(maxSequenceLength: 4)`
  — every edge; many more tests.
- `SequentialTestCaseAlgorithms.CreateRandomWalk(numberOfWalks: 200,
  maxWalkLength: 8, seed: 42)` — sampling for graphs too large to cover;
  always pass a seed so failures reproduce.

The delegate takes the root `StateGraphNode`, so a custom walk is a function
you write.

## 8. Run, and fail with the spec's message

```csharp
var initial = new AppState();
var tests = spec.GenerateTests(initial, inputs, gen);
var results = await spec.RunTests(context, initial, tests, options);

var failures = results.Where(r => !r.Success).ToList();
Assert.That(failures, Is.Empty,
    $"{failures.Count} failed. First: {failures.FirstOrDefault()?.LastFailureMessage}");
```

`StopOnFirstFailure` defaults to `true`; set it to `false` to see every
failing sequence. Each result has a `LogFilePath` with the full step log.

## 9. Derive requests that need a prior response

When the client chooses IDs, no derivation is needed — every request is
known up front. When the server generates them, tell the runner how to
build the next request from an earlier call:

```csharp
spec.ConfigureDerivations("GetTodo",
    Derive.From<CreateTodoRequest, CreateTodoResponse, string>("CreateTodo")
        .When((req, resp) => resp.IsSuccess)
        .As((req, resp) => resp.TodoId));
```

`ConfigureDerivations` works only on inline operations; a class-based
operation overrides `DerivedFrom` instead. `.AsVariants(…)` returns a
labeled dictionary of requests (Approve / Reject / Cancel from one order);
the three-argument `.As((req, resp, template) => …)` mixes in test data from
`TestGenerationOptions.RequestTemplates`. Derivations serve the built-in
runner only — if you drive the system yourself (ORACLE.md), you thread the
values through your own code.

---

Once sequential tests pass, CONCURRENCY.md reuses the same spec, inputs,
and context. When a run goes red, DEBUG.md decides whether the spec or the
system is wrong.
