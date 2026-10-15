# Writing a spec

You're writing the contract: a minimal state and, for each operation, the
rule that maps (request, state) to the correct responses and the next
state. Nothing here calls the system. Apply the rules in order.

## 1. Pick a small cluster of related operations

Accordant tests *sequences*, so start with two to four operations that
share state — Create, Get, Delete for one resource — not one operation, and
not the whole API. Read the controllers or service interface for the shape,
and ask about the rules you can't see: does deleting a user cascade to their
todos? Does a second Create conflict or overwrite? Don't assume HTTP; an
in-process library is just as testable.

Take the rules from the contract — API docs, the ticket, whoever owns the
behavior — not from the implementation. A spec transcribed from the code
agrees with it, bugs included, and every test passes. Read the code for
names, types, and the order of refusals (rule 3); when the code and the
contract disagree, that's a finding to raise (DEBUG.md rule 4), not a
rule to copy.

## 2. State is what the spec remembers, not what the system stores

Model only what you need to decide whether a response is correct. A bank
needs account balances, not tables, rows, or audit logs. Most specs start as
one dictionary keyed by the IDs the client chooses.

```csharp
[State]
public partial class AppState
{
    public Dictionary<string, UserState> Users { get; set; } = new();
}

[State]
public partial class UserState
{
    public string Name { get; set; } = string.Empty;
    public Dictionary<string, TodoState> Todos { get; set; } = new();
}
```

`[State]` source-generates clone, equality, hashing, and freezing. The
generator accepts a non-abstract `partial class` at namespace level (not
nested, not a record or struct) with a parameterless constructor, whose
public `{ get; set; }` properties are primitives, strings, enums,
`DateTime`/`DateTimeOffset`/`TimeSpan`/`Guid`/`DateOnly`/`TimeOnly`,
nullables of those, other `[State]` classes, `List<T>`, one-dimensional
arrays, tuples, or `Dictionary<K,V>` keyed by a primitive, string, enum, or
one of those date/time/ID types (not a tuple or a nullable). It rejects,
with a `STATE0xx` diagnostic: `HashSet` (use `List`), interface-typed
properties (`IList`, `IDictionary`), fields, `init` properties, getter-only
properties of a mutable type, `required` members, and multidimensional
arrays. A getter-only property of an immutable type (a computed `string`)
is allowed and left out of clone, equality, and hashing.
Every nested class needs its own `[State]`.

Every transition deep-clones the state. A large value that never changes
once set (file contents, an image) goes in a `[SharedState(Fingerprint =
nameof(ContentFingerprint))]` property instead: it's copied by reference,
and the fingerprint — a method taking the property's value, or a string
property, returning a deterministic `string` — stands in for it in
equality. A `[State]`-typed shared property can omit it; its own string
form is used. Never
mutate a shared value — every clone sees the change.

## 3. One guard per refusal, in the implementation's order

Each refusal is an early `return` with its own outcome. Order is the one
thing to take from the code (rule 1). Check them in the order the
implementation does: if the real code checks "user exists" before
"todo exists", so does the spec, or a request that fails both checks gets a
different answer from each. Use `TryGetValue`; never index a dictionary you
haven't checked.

```csharp
spec.Operation<Todo, ApiResult<Todo>>("CreateTodo", (request, state) =>
{
    if (!state.Users.TryGetValue(request.UserId, out var user))
        return Expect.That<ApiResult<Todo>>(r => r.IsNotFound,
                   $"User '{request.UserId}' doesn't exist → 404")
               .SameState();

    if (user.Todos.ContainsKey(request.TodoId))
        return Expect.That<ApiResult<Todo>>(r => r.IsConflict,
                   $"Todo '{request.TodoId}' already exists → 409")
               .SameState();

    return Expect.That<ApiResult<Todo>>(
               r => r.IsSuccess && r.Data!.TodoId == request.TodoId &&
                    r.Data.Title == request.Title && !r.Data.Completed,
               "New todo → 200 with the todo, not completed")
           .ThenState<AppState>(next =>
               next.Users[request.UserId].Todos[request.TodoId] =
                   new TodoState { Title = request.Title });
});
```

## 4. Use the form that compiles where you are

Inline operations hang off a spec you create with `var spec = new
Spec<AppState>();` (`spec.Operation<TReq, TResp>(name, (req, state) => …)`)
and use the static `Expect`, which can't infer types: write
`Expect.That<TResp>(…)` and `.ThenState<TState>(…)`. Class-based operations
(`Operation<TReq, TResp, TState>`) get a typed `Expect` property, so the
short form `Expect.That(r => …).ThenState(next => …)` works only there.
Some docs and samples show the short form inside inline lambdas — it won't
compile.

```csharp
public class GetUserOperation : Operation<string, ApiResult<User>, AppState>
{
    public GetUserOperation() : base("GetUser") { }

    public override ExpectedOutcomes Apply(string userId, AppState state) =>
        state.Users.TryGetValue(userId, out var user)
            ? Expect.That(r => r.IsSuccess && r.Data!.Name == user.Name,
                  $"User '{userId}' → 200 with name '{user.Name}'").SameState()
            : Expect.That(r => r.IsNotFound, $"User '{userId}' → 404").SameState();
}

public class AppSpec : Spec<AppState>
{
    public GetUserOperation GetUser { get; } = new();
    public AppSpec() => RegisterOperationProperties();
}
```

Start inline; inline operations get polling and derivations through
`spec.ConfigurePolling` and `spec.ConfigureDerivations`. Move to classes
when an operation needs an `ExecuteAsync` next to its `Apply`, or a shared
base class (FAULTS.md rule 4).

## 5. Refusals and reads keep the state

Every error branch and every read ends in `.SameState()`. An operation that
throws is declared with `Expect.Throws<TException>(explanation)` (or the
overload with a predicate on the exception) — it's an outcome, not a test
failure. A `void`/`Task` operation responds with `Unit`: declare
`spec.Operation<TReq, Unit>`, expect `Expect.Unit(explanation)`, and return
`Unit.Value` from the binding. Every outcome needs its state step:
`Expect.Unit(…)` or `Expect.Throws<T>(…)` alone compiles, then throws
`InvalidOperationException` when the outcome is built — end it in
`.SameState()` or, for a write that succeeds, `.ThenState(…)`.

## 6. Change state only inside `ThenState`

`ThenState` clones the current state and hands you the clone. Compute
values from `state` up front, write them to `next`, and never mutate
`state` itself — it's frozen, and mutating it would corrupt every other
branch that shares it.

```csharp
var newBalance = balance - request.Amount;          // read from state
return Expect.That<WithdrawResponse>(r => r.IsSuccess && r.Balance == newBalance,
           $"Withdraw → balance {newBalance}")
       .ThenState<BankState>(next => next.Accounts[request.AccountId] = newBalance);
```

If the state is a graph whose objects reference each other, use
`ThenStateWithMap<TState>((next, map) => …)` to translate original
references to their clones.

State the properties no transition may break at the end of `ThenState`,
with `Invariant.Assert` (it ships in the package):

```csharp
.ThenState<BankState>(next =>
{
    next.Accounts[request.AccountId] = newBalance;
    Invariant.Assert(next.Accounts.Values.All(b => b >= 0), "No balance goes negative");
});
```

Generation runs every `ThenState` in every reachable state, so a spec
rule that breaks a property fails a generation-only test (GENERATE.md
rule 6) with the path that broke it, before the spec judges the system
by a wrong rule.

## 7. Predicates check the payload, and explain themselves

`r => r.IsSuccess` passes when the wrong user comes back. Check every field
the spec knows: IDs, names, counts, balances. Always pass the explanation
string — it's the failure message in generated tests and trace validation.
Write it as `"<situation> → <outcome>"` (`"Todo 'x' already exists → 409"`).
Read in a row, the strings are the contract in words, so a diff of them
between two versions of the spec is the review a contract change needs
(TRACES.md rule 9).
When several fields can be wrong, return a `ValidationResult` so the
message names the field and the actual value. That overload of
`Expect.That` takes no explanation string (0.1.6), so a one-argument call
loses the `"<situation> → <outcome>"` line. Fold it into the failure
message with a helper:

```csharp
static ExpectedOutcomeBuilder<TResp> Judge<TResp>(
    string why, Func<TResp, ValidationResult> check) =>
    Expect.That<TResp>(r =>
    {
        var v = check(r);
        return v.IsValid ? v : ValidationResult.Invalid($"{why}: {v.FailureMessage}");
    });

Judge<ApiResult<User>>($"User '{id}' exists → 200 with its name", r =>
    r.Data?.Name != user.Name
        ? ValidationResult.Invalid($"Name: expected '{user.Name}', got '{r.Data?.Name}'")
        : ValidationResult.Valid())
```

Passing the string as a second argument to the `ValidationResult` form
does not compile; the `bool` form `Expect.That<T>(r => …, "why")` does.

## 8. Capture what you can't predict, then hold it stable

Server-generated values (IDs, timestamps, ETags) can't be predicted, so
check they exist, then capture them with the response-aware `ThenState`.
It requires a `mock` response: generation simulates the spec without a
server and needs a plausible response to build the next state; execution
ignores the mock and uses the real response.

```csharp
.ThenState<AppState>(
    (ApiResult<Order> resp, AppState next) =>
        next.Orders[resp.Data!.OrderId] = new OrderState { Product = request.Product },
    mock: () => new ApiResult<Order>
    {
        StatusCode = 201,
        Data = new Order { OrderId = "mock-1", Product = request.Product },
    })
```

Once captured, later reads must return exactly that value: compare against
the captured field and keep `.SameState()`. A value that's set once and
never changes is a property the spec enforces, not a detail it skips.

## 9. Leave out what doesn't matter yet

A spec can be partial and still catch bugs. Skip fields you don't care
about, operations you aren't testing, and edge cases you'll add later. An
unmodeled detail should be absent from the predicate, not guessed at — a
guessed rule fails on correct behavior and teaches the user to distrust
the spec.

## 10. Time is an input

Expiry, leases, token lifetimes, and rate-limit windows depend on a clock
the generator doesn't control, so with a real clock they go untested. Put
the clock in the spec: keep "now" in the state, make advancing it an
operation, and have the system read an injected `TimeProvider`, with
`FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`) in
tests:

```csharp
spec.Operation<int, Unit>("Advance", (seconds, state) =>
    Expect.Unit($"Clock +{seconds}s")
          .ThenState<AppState>(next => next.Now = state.Now + seconds));

spec.Operation<string, ApiResult<Session>>("GetSession", (token, state) =>
{
    if (!state.Sessions.TryGetValue(token, out var expiresAt) || state.Now >= expiresAt)
        return Expect.That<ApiResult<Session>>(r => r.IsUnauthorized,
                   $"Session '{token}' missing or expired at {state.Now} → 401")
               .SameState();
    // …
});

spec.ExecuteWith<FakeTimeProvider>()
    .Bind<int, Unit>("Advance", (clock, seconds) =>
    {
        clock.Advance(TimeSpan.FromSeconds(seconds));
        return Unit.Value;
    });
```

Pick advances that land on the boundary — with a 60-second TTL, `59` and
`1` reach just before, at, and just after it — and cap `Now` in the
`StateConstraint`, or the clock alone makes the space infinite. Whether
the session dies at 60 or after it is a contract question (rule 1). A
system you can't host in the test needs a test-only endpoint that moves
its clock.

---

GENERATE.md runs this spec against the system. When an operation can
legitimately answer in more than one way, FAULTS.md and ASYNC.md extend
rule 3's single outcome into several.
