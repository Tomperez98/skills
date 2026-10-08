# Background work and polling

An operation returns `Pending` and the real work finishes later, outside any
call. The model says *what can happen* in the background (step functions);
the test runner decides *how long to wait for it* (polling). Keep the two
apart. Apply the rules in order.

## 1. Model the background work where it starts

The operation that kicks off the work declares it with `.Triggers(…)`.
`AsyncOperation.Create` covers the common case: a predicate for "done" and
the transition that gets there.

```csharp
return Expect.That(r => r.IsSuccess && r.Data!.Status == JobStatus.Pending,
           "Create → 200 Pending")
       .ThenState(next => next.Jobs[jobId] = new JobState { Status = JobStatus.Pending })
       .Triggers(AsyncOperation.Create<JobQueueState>(
           isTerminal: s => !s.Jobs.ContainsKey(jobId) ||
                            s.Jobs[jobId].Status != JobStatus.Pending,
           transition: next => next.Jobs[jobId].Status = JobStatus.Completed));
```

(Short-form `Expect` because this is a class-based operation — SPEC.md rule
4.) Write `isTerminal` so it holds in every state the work can see,
including after the resource was deleted; an unguarded `s.Jobs[jobId]` is a
spec crash the first time a Delete races the job.

## 2. Every possible ending is a transition

If the work can succeed or fail, list both with `transitions:` — each entry
gets its own cloned state:

```csharp
.Triggers(AsyncOperation.Create<JobQueueState>(
    isTerminal: s => s.Jobs[jobId].Status != JobStatus.Pending,
    transitions: new Action<JobQueueState>[]
    {
        next => next.Jobs[jobId].Status = JobStatus.Completed,
        next => next.Jobs[jobId].Status = JobStatus.Failed,
    }))
```

Use `.TriggersWhen(predicate, stepFunction)` when the response decides
whether background work started at all (a 202 starts it, a 200 doesn't).

## 3. Reads must tell the candidate states apart

Right after the trigger, the system may be `Pending`, `Completed`, or
`Failed`, and Accordant keeps all three. A read narrows them: each candidate
runs the read's `Apply`, and only candidates whose expected response matches
the observed one survive. That works only if the read's expectation depends
on the state — `r.Data.Status == job.Status`, not `r.IsSuccess`. A read that
accepts the same response in every candidate never resolves anything.

## 4. Learn the result once, then hold it

Values the server produces on completion (a result path, a computed total)
can't be set by the transition. The read captures them the first time it
sees them and enforces them afterwards — two separate branches:

```csharp
if (job.Status == JobStatus.Completed && job.ResultPath == null)
    return Expect.That(r => r.Data!.Status == JobStatus.Completed &&
                            !string.IsNullOrEmpty(r.Data.ResultPath),
               "First Completed read → has a ResultPath")
           .ThenState((resp, next) => next.Jobs[jobId].ResultPath = resp.Data!.ResultPath,
               mock: () => new ApiResult<Job>
               {
                   StatusCode = 200,
                   Data = new Job(jobId, JobStatus.Completed, "/mock/path"),
               });

if (job.Status == JobStatus.Completed)
    return Expect.That(r => r.Data!.ResultPath == job.ResultPath,
               $"ResultPath stays {job.ResultPath}")
           .SameState();
```

## 5. Polling is configuration for the runner, not part of the model

To have `spec.RunTests` wait for the work, attach a `PollingSetup` to the
triggering operation — override `Polling` on a class-based operation, or
call `spec.ConfigurePolling(name, …)` for an inline one:

```csharp
public override PollingSetup Polling => new PollingSetup
{
    Operation = "GetJob",   // what to call while waiting
    WaitTimeInMs = 100,     // default 1000
    MaxRetryCount = 100,    // default 50
};
```

The runner calls the poll operation until every surviving candidate state
satisfies `isTerminal`. If you drive the system yourself (ORACLE.md), you
write that loop instead and keep the step functions unchanged.

## 6. The poll operation derives its request from the trigger

The runner can't guess which job to poll. Give the poll operation a
derivation from the triggering one, even when the ID is the client's own:

```csharp
public override IReadOnlyList<RequestDerivation> DerivedFrom => new[]
{
    Derive.From<string, ApiResult<Job>, string>("CreateJob")
          .As((jobId, resp) => jobId),          // client-chosen ID
};
// server-generated: .When((req, resp) => resp.IsSuccess).As((req, resp) => resp.Data!.JobId)
```

## 7. `MaxRetryCount` is the liveness bound

A job that stays `Pending` forever isn't wrong, it's stuck — a liveness
bug. When polling runs out while a candidate is still non-terminal, the
test fails. Set `WaitTimeInMs × MaxRetryCount` to the longest the system is
*allowed* to take, not the longest you're willing to wait.

## 8. Go below `AsyncOperation.Create` only when it can't express the work

Subclass `TerminatingStepFunction` (override `IsTerminalState` and
`GetStepResults`) when an outcome needs custom logic or spawns further step
functions. Subclass `BaseStepFunction` and return itself in each
`StepResult.StepFunctions` for work that never ends — a garbage collector,
a reconciler. During generation, terminating step functions are unwound to
completion by default (`TestGenerationOptions.ShouldUnwindStepFunction`) so
generated cases describe whole scenarios.

---

Server-generated IDs without any background work need only GENERATE.md
rule 9. Background work combined with timeouts is FAULTS.md territory: the
trigger itself may or may not have happened.
