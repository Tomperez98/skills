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
generator only accepts: a `partial class` at namespace level (not nested,
not a record or struct) with a parameterless constructor, whose properties
are primitives, enums, `DateTime`/`TimeSpan`/`Guid`/`DateOnly`/`TimeOnly`,
other `[State]` classes, `List<T>`, arrays, tuples, or `Dictionary<K,V>`
with a primitive, string, or enum key. No `HashSet` (use `List`), no
interface-typed properties (`IList`, `IDictionary`). Every nested class
needs its own `[State]`.

## 3. One guard per refusal, in the implementation's order

Each refusal is an early `return` with its own outcome. Check them in the
order the implementation does: if the real code checks "user exists" before
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

Inline operations (`spec.Operation<TReq, TResp>(name, (req, state) => …)`)
use the static `Expect`, which can't infer types: write
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

Start inline. Move to classes when an operation needs `Polling` or
`DerivedFrom` overrides, an `ExecuteAsync` next to its `Apply`, or a shared
base class (FAULTS.md rule 4).

## 5. Refusals and reads keep the state

Every error branch and every read ends in `.SameState()`. An operation that
throws is declared with `Expect.Throws<TException>(explanation)` (or the
overload with a predicate on the exception) — it's an outcome, not a test
failure. A `void`/`Task` operation responds with `Unit`: declare
`spec.Operation<TReq, Unit>`, expect `Expect.Unit(explanation)`, and return
`Unit.Value` from the binding.

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

## 7. Predicates check the payload, and explain themselves

`r => r.IsSuccess` passes when the wrong user comes back. Check every field
the spec knows: IDs, names, counts, balances. Always pass the explanation
string — it's the failure message in generated tests and trace validation.
When several fields can be wrong, return a `ValidationResult` so the
message names the field and the actual value:

```csharp
Expect.That<ApiResult<User>>(r =>
    r.Data?.Name != user.Name
        ? ValidationResult.Invalid($"Name: expected '{user.Name}', got '{r.Data?.Name}'")
        : ValidationResult.Valid())
```

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

---

GENERATE.md runs this spec against the system. When an operation can
legitimately answer in more than one way, FAULTS.md and ASYNC.md extend
rule 3's single outcome into several.
