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

The target type is yours, and so is the transport. A binding is any
function from request to response, so it can call anything .NET can reach.
Only the binding changes between transports; the spec stays the same:

```csharp
spec.ExecuteWith<Orders.OrdersClient>()                  // gRPC
    .BindAsync<PlaceOrder, OrderReply>("PlaceOrder",
        async (c, req) => await c.PlaceAsync(req));

spec.ExecuteWith<QueueHarness>()                         // message queue
    .BindAsync<PlaceOrder, OrderReply>("PlaceOrder",
        (q, req) => q.PublishAndAwaitReplyAsync("orders.place", req));

spec.ExecuteWith<CliRunner>()                            // CLI process
    .BindAsync<PlaceOrder, OrderReply>("PlaceOrder",
        (cli, req) => cli.RunAsync("orders", "place", req.Sku));

spec.ExecuteWith<OrderService>()                         // in-process library
    .Bind<PlaceOrder, OrderReply>("PlaceOrder",
        (svc, req) => svc.Place(req));
```

Map whatever the transport returns (a status code, an exit code and stdout,
a reply message, a thrown exception) into the response type the spec
expects. A binding can also throw, and the spec declares that with
`Expect.Throws<T>`. For systems that emit events instead of answering
requests, see ORACLE.md rule 6. For systems .NET can't call at all, see
ORACLE.md rules 3 and 5.

## 2. Register the target in a testing context

The runner resolves bound targets from a `TestingContext`:

```csharp
var context = spec.CreateTestingContext();
context.Register(new TodoApiClient(factory.CreateClient()));
```

Call `spec.WithJsonPrinters()` when you build the spec so requests and
responses print as JSON in failure logs. Skip it when an operation declares
`Expect.Throws`: the printer can't serialize the exception, and the throw
fails a test that passed. It also prints a tuple request as `{}`.

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

A `Unit`-request operation takes just a label: `pop.With("Pop")`. That overload
is `With(string label)`, so on a `string`-request operation pass both request
and label — `getUser.With("alice")` builds a `Unit` request and fails at
execution. Five or six inputs routinely yield dozens of sequences; add inputs
only when a branch isn't covered.

When a request has several independent fields or flags, pick values so
every pair of them appears in some input (a pairwise tool such as PICT
lists them). Most interaction bugs involve two parameters, and the
system can branch on a pair the spec never mentions.

A filter or validation matrix belongs to its own `InputSet`; it never rides in
the shared one, where every value multiplies every sequence. A clock input
(`Advance`, `Tick`) carries boundaries only — the expiry, the floor, their ±1,
and the refusals — because every extra clock value multiplies every sequence
(SPEC.md rule 11).

Two more kinds of input catch what branch-aimed inputs miss:

- **A second entity.** A Delete or Update that also touches a record it
  shouldn't — the wrong row, a shared parent, a cascade too far — shows
  only when another record exists to be hit. Create bob next to alice, and
  read bob after acting on alice.
- **A read for every write.** The spec judges responses, so a change no
  later response shows is never checked. Give each state change a read
  that observes it, and add a read of everything (`List users`) so a
  record that leaks, or should be gone, has a response to fail.

## 5. Bound the graph before it bounds you

Exploration applies every input in every reachable state, so the graph can
grow exponentially. `TestGenerationOptions` bounds it:

- `MaxDepth` (default 5) — the longest sequence explored; `-1` is unbounded
  and never terminates on an unbounded state (a counter). It is not a
  guarantee: see below.
- `StateConstraint` — drop states you don't care about. The edge into a
  failing state is dropped too, so the call that would cross the bound
  (a third Create under `Users.Count <= 2`) is never tested; set the
  bound one past the case you need.
- `ShouldApply` — skip an input in states where it makes no sense.
- `MaxOperationApplicationCount` — reuse each input at most N times per path.
- `ShouldIncludeTransition` — drop one kind of edge, `(from, call, to) =>
bool`. Prune narrowly (a refused Cancel in a state you've already
  covered); dropping every self-loop removes the reads, and the reads are
  what check the state.
- `DerivationSelectors` — keep only the derived requests you name (rule 9);
  an empty list turns derivations off.

```csharp
var gen = new TestGenerationOptions
{
    MaxDepth = 4,
    StateConstraint = s => ((AppState)s).Users.Count <= 2,
    DerivationSelectors = [DerivationSelector.For("ApproveOrder").From("CreateOrder")],
};
```

`StateConstraint` receives an `IState`, `ShouldApply` receives
`(OperationInput input, IState state)`, and `ShouldIncludeTransition`
receives `(IState from, OperationCall call, IState to)`; cast the state to
your type. Compare states with `GetStateHash()`. State `MaxDepth`,
`MaxOperationApplicationCount`, and `StateConstraint` explicitly in every
profile; a default is not a decision.

**Bound by state, not by depth, when you need every state.** Exploration
is depth-first and keeps a state's depth from the first path that reaches
it, so a state first reached the long way gets its children cut early.
States reachable within `MaxDepth` go missing, with no warning. From
counter 1 with `+1` and `×2` inputs, `MaxDepth = 5` finds 10 of the 12
states four calls can reach (Accordant 0b2c0d4). A finite state space
explored to the end has no such gap: cap the state with `StateConstraint`
(at most two users, balances up to 500) and set `MaxDepth = -1`. Most bugs
show up in small instances, so a small, finite space covered completely
beats a large one cut by depth. If you must keep `MaxDepth`, compare its
state count with a `MaxDepth = -1` run under the same constraint; any
difference is states your tests never reach.

**Shrink the system's limits to fit the space.** A small space never
reaches a quota of 100 or a page of 50, so the bugs at those edges stay
untested. Make each limit configurable in the system, set it to 2 or 3 in
the test setup, and use the same constant in the spec; the boundary is
then a few calls deep, where exploration covers it.

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

- `SequentialTestCaseAlgorithms.StateCoverage` (default) — every path
  that doesn't revisit a state, so every state and every edge of the
  explored graph lands in some case. The count grows exponentially with
  the graph's width.
- `SequentialTestCaseAlgorithms.CreateTransitionCoverage(maxSequenceLength: 4)`
  — every path up to the length (default 3) that never takes the same
  edge twice; far more cases than `StateCoverage`.
- `SequentialTestCaseAlgorithms.CreateRandomWalk(numberOfWalks: 200,
maxWalkLength: 8, seed: 42)` — sampling for graphs too large to cover;
  also never takes an edge twice. Pass a seed so failures
  reproduce.

All three use an input many times in one case (deposit, deposit,
deposit), but none goes around a cycle: Create → Delete → Create is never
generated. To cover a cycle, or a branch the green suite never reaches,
follow COVERAGE.md.

To run a sequence you chose yourself, name its input labels in order. A
label can appear only once per case — the runner rejects a repeat — so a
second read of the same thing gets its own input (`"Get alice again"`):

```csharp
var test = TestCaseGenerator.CreateManualSequentialTestCase(
    context, inputs, "Create alice", "Get alice", "Get ghost");
```

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
failing sequence. Results come back in the order of the cases, so
`tests[i].Description` names a failing `results[i]`; the step log is in
`LogFilePath`, the run's log folder (DEBUG.md rule 8).

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
`TestGenerationOptions.RequestTemplates`. Every derivation spawns new
inputs, and variants multiply them; when generation grows, narrow it with
`DerivationSelectors` (`.For(target).From(source).Variant(label)`, rule 5).

A derivation has exactly one source call. `Derive.From("CreateUser",
"CreateGroup")` compiles, but neither generation nor execution passes it
more than the first source. Generation fails with a
`TestCaseGenerationException` wrapping a `KeyNotFoundException` from
`DerivationSources` (or, when the target is also in the `InputSet`, an
`OperationValidationException` saying only single-source derivations are
supported). When a request needs two server-generated IDs (add a
user to a group), keep logical names in the request and resolve them in
the binding: the create bindings record name → ID in a registry you
register in the context, the `AddMember` binding looks both up, and
`BeforeEachAsync` clears it with the system.

Derivations serve the built-in runner only — if you drive the system
yourself (ORACLE.md), you thread the values through your own code.

---

- **Sequential tests pass and races are next** → CONCURRENCY.md, with the
  same spec, inputs, and context.
- **A run goes red** → DEBUG.md.
- **More than one cluster, or a suite to budget** → SUITES.md.

## Done when

- Every operation has a binding with its exact name and types, and async
  APIs go through `BindAsync` (rule 1).
- `BeforeEachAsync` puts the system in the spec's initial state before
  every test (rule 3).
- Every guard in the spec has an input that fires it, and every write has
  a read that observes it (rule 4).
- A generation-only run finished with a non-empty, bounded graph, every
  `Apply` branch is an edge or a self-loop in the rendered graph, and no
  state in it is unexpected (rules 5–6).
- The real run asserts that no result failed, and a failure reports the
  spec's message (rule 8).
