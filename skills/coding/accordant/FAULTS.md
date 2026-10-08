# Timeouts, 500s, and indefinite failures

A call timed out. Maybe the request never arrived, maybe the server did the
work and the response got lost — from the client both look the same, and
the system is in a different state in each. The spec lists every
explanation and lets later responses decide. Apply the rules in order.

## 1. Sort every response into one of three kinds

- **Success** — the server did the work and you saw the result.
- **Definite failure** — the server refused (400, 404, 409, a domain
  exception) and did nothing. One outcome, `.SameState()`.
- **Indefinite failure** — timeout, connection reset, 500, 503: you can't
  tell whether the effect happened. Two outcomes.

Make the response type able to say "indefinite" (an `IsTimeout` or
`IsIndefiniteFailure` flag set by the client wrapper), or declare the
exception your client throws with `Expect.Throws<TException>`.

## 2. An indefinite failure is two outcomes, not a guess

```csharp
return Expect.OneOf(
    Expect.That<CreateAccountResponse>(r => r.IsSuccess && r.Balance == 0, "Created")
          .ThenState<BankState>(next => next.Accounts[request.AccountId] = 0),
    Expect.That<CreateAccountResponse>(r => r.IsTimeout, "Timeout: request lost")
          .SameState(),
    Expect.That<CreateAccountResponse>(r => r.IsTimeout, "Timeout: response lost")
          .ThenState<BankState>(next => next.Accounts[request.AccountId] = 0));
```

A timeout matches both of the last two outcomes, so the state profile now
holds both worlds. Never pick one: "a timeout means it failed" rejects a
correct server the first time the response is lost.

## 3. Later responses resolve the ambiguity — and catch the bug

After the timeout, `GetAccount("alice")` → 404 eliminates the world where
alice exists; → 200 eliminates the other. The bug is a response no
surviving world explains: a 404, then a deposit to alice that succeeds.
Write reads that depend on state (ASYNC.md rule 3) so they can do the
eliminating.

## 4. Add failure outcomes in one place, not in every operation

Most operations need the same two extra outcomes. Put them in a base class
that wraps happy-path logic, as the `TodoList-FaultInjection` sample does:

```csharp
public abstract class FaultTolerantOperation<TReq, TResp, TState> : Operation<TReq, TResp, TState>
    where TState : class, IState
{
    protected FaultTolerantOperation(string name) : base(name) { }

    protected abstract ExpectedOutcomes ApplyInternal(TReq request, TState state);

    public sealed override ExpectedOutcomes Apply(TReq request, TState state)
    {
        var outcomes = ApplyInternal(request, state).PossibleOutcomes.ToList();
        // + "indefinite failure, state unchanged"
        // + for each state-changing outcome: "indefinite failure, same next state"
        return new ExpectedOutcomes(outcomes.ToArray());
    }
}
```

Operations then declare only their definite behavior, and the failure model
can't drift between them.

## 5. When the effect may have happened but you never saw its ID

A create that timed out might have made a server-generated ID you'll never
learn. Model the uncertainty explicitly — a `MaybeExists` list or a
`HasUnknownJob` flag — and let later listings accept one unrecognized item
while that flag is set, then capture it and clear the flag. Don't invent a
placeholder ID; no real response will ever match it.

## 6. Keep exploration deterministic; let execution see the faults

Every indefinite outcome doubles the branches, so generating with failure
outcomes enabled explodes the graph with worlds no fault-free path needs.
Generate with them off and run with them on, using a flag you own (the
sample's `IndefiniteFailureSemantics`, an `AsyncLocal<bool>` read by the
base class):

```csharp
var tests = IndefiniteFailureSemantics.Suppress(() =>
    spec.GenerateTests(initial, inputs, new TestGenerationOptions { MaxDepth = 4 }));

IndefiniteFailureSemantics.Enabled = true;
var results = await spec.RunTests(context, initial, tests, options);
```

## 7. Inject faults where the system meets the outside world

Ambiguity needs a cause. Wrap the client to fail before sending (request
lost) or after receiving (response lost), put a proxy in the path that drops
or delays, or make the data layer fail before or after the save. Inject on
both sides, or one of the two worlds in rule 2 is never exercised. For
throttling responses that are safe to repeat (429), let the runner retry
with `TestExecutionOptions.ShouldRetry` returning a `RetryBehavior` instead of
modeling each attempt.

---

The same profile mechanics drive ASYNC.md: a pending job is uncertainty
that resolves over time. CONCURRENCY.md combines with this branch when a
failed call might still have taken effect.
