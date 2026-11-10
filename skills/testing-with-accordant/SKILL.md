---
name: testing-with-accordant
description: Applies Accordant (Microsoft.Accordant), a model-based testing framework, to write executable specs whose state and operations generate and validate test sequences against a real system in any language, bound over its HTTP, gRPC, or other API. Use when adding model-based, stateful, or operation-sequence tests to a service, API, or library (Go, Python, Java, Node, Rust, or .NET), writing a spec with [State], spec.Operation, Expect.That, SameState, or ThenState, generating tests with InputSet, GenerateTests, or RunTests, finding race conditions with concurrent tests and linearizability, testing background jobs with polling, validating traces or exported test plans from a system in another language, or debugging a failing Accordant spec.
---

# Testing with Accordant

Accordant is the default for model-based testing. Write a spec once, and Accordant explores operation sequences, runs them against the real system, and checks every response. If another workflow skill is active, it owns the steps. Apply these rules inside each step. For general test rules (mutants, determinism, test-owned state), writing-code's tests reference applies too.

**One rule: the spec is an oracle for observable behavior, and it is simpler than the implementation.** State holds only what an outside caller needs to predict the next response, never storage details. A spec that repeats the implementation's logic agrees with its bugs.

## Any system, one .NET test project
The spec and its test project are C#. The system under test can be in any language. Pick the binding by how the system can be reached:
- Network API (HTTP, gRPC, a message queue): the default. Create a standalone .NET test project and bind each operation to a thin typed client that returns `ApiResult<T>` (status plus parsed body). The server's language doesn't matter, and the full workflow (generation, `RunTests`, polling, concurrency) applies.
- In-process .NET library: bind to its types directly, with no client.
- Native library (C, C++, Rust): bind through P/Invoke from the .NET test project.
- Only when calling from .NET isn't practical (an embedded target, or an existing harness in another language that must drive the calls): by default, export test plans as JSON for that harness to run and validate the traces it records, so the spec still chooses the sequences. Validate only recorded traces when the harness can't run arbitrary sequences (fixed scripts, production logs). Read [reference/testing-any-system.md](reference/testing-any-system.md).

Don't assume HTTP, and don't assume the system is .NET. Check how it's started and called.

## Writing the spec
- One `[State]` `partial` class. Start from a `Dictionary<string, T>` of what exists, and add a field only when an operation's expected outcome needs it.
- Each operation is a truth table: guard clauses for each error case first, the success case last. Errors and reads end in `.SameState()`. Mutations end in `.ThenState(s => ...)`, which mutates the copy it is passed (`s`), never the `state` argument.
- Give every `Expect.That` an explanation naming the case and the value (`$"404: key '{key}' doesn't exist"`), so a failure names the rule it broke.
- Predicates assert the status and the payload (`r.IsSuccess && r.Data == newBalance`), not just success. A predicate that accepts any 2xx catches nothing.
- When the system may legitimately do one of several things, list each outcome with `Expect.OneOf`. Never loosen a predicate to make a nondeterministic case pass.
- Values the server generates (IDs, ETags, timestamps) go into state from the response. See the response-dependent state pattern before modelling them.
- A spec can be partial. Model a small cluster of 2-4 related operations (Create, Get, Delete) with the success case and one key error case, get them green, then add cases.
- Write only Accordant API calls you have seen in a reference file: the namespace is `Microsoft.Accordant`, and inputs are built with `op.With(request, "label")` inside an `InputSet`. When unsure of a signature, check [reference/quickref.md](reference/quickref.md) before writing it, and never invent an overload.
- Once a spec is in use, keep a trace database of traces it accepts and replay them after every change to the spec, so a spec regression fails before it reaches the system under test. When a change rejects an old trace, explain each rejection as an intended behavior change before re-recording; an unexplained rejection is a spec bug.
- Ask the user about domain behavior you can't read from the code (does deleting a user cascade to their todos?). Never guess a rule into the spec.

## Where Accordant's own examples are wrong
The reference files keep the upstream text. These rules override it:
- Bind async clients with `BindAsync` and `await`. Several examples use `Bind(... .Result)` for brevity, which can deadlock.
- Check every `spec.Allows` result and carry the returned `StateProfile` into the next call. An ignored result validates nothing.
- Every polled operation sets `MaxRetryCount` and `WaitTimeInMs` explicitly, sized to how long the job really takes (the default is 50 retries), and every hand-written poll loop has a retry cap or deadline that throws when hit.
- The last section of `request-derivations.md` says "If the request can be constructed without any prior operation data, you do need to write a derivation function." It means the opposite: you don't need one.
- Pin `Microsoft.Accordant` to the version `dotnet add package` resolves. Never copy a floating `Version="*"`.
- Reset state in `BeforeEachAsync` with the mechanism the project's integration tests already use (DB reset, container recreation, deleting known entities, unique IDs per run), so each generated test owns its state. A reset that fails throws and fails that test case. Never swallow its errors (a 404 from a reset hook means the hook is missing, not that state is clean).

## First spec in a project
Copy this checklist and follow it in order:
1. Read the existing integration tests, in whatever language: how the system starts (process, container, `WebApplicationFactory`), its base URL or entry point, how state is reset. Reuse all of it.
2. For a .NET repo, add the package to its integration test project (`dotnet add package Microsoft.Accordant`), matching its framework (xUnit, NUnit, MSTest). For any other repo, create a standalone .NET test project (`dotnet new xunit`, then `dotnet add package Microsoft.Accordant`) in its own directory, and tell the user it needs the .NET SDK.
3. Write the `[State]` class with the user. State design decides everything after it, so don't skip it.
4. Write 2-4 related operations.
5. Bind each operation to the real system with `spec.ExecuteWith<TClient>().BindAsync(...)`, where `TClient` is the typed API client (or the library type). Names and request/response types must match the operation exactly. Take the base URL from config, not a hard-coded host.
6. Add the state reset in `BeforeEachAsync`.
7. Build an `InputSet` with 2-5 labelled inputs, including one that hits an error case. Generate with `MaxDepth` 3 or 4.
8. Run `dotnet test`. On failure, read [reference/troubleshooting.md](reference/troubleshooting.md), fix the spec, the binding, or the reset, and re-run until green. A real implementation bug goes to the user with the failing sequence.
9. Break one predicate (expect the wrong status) and confirm a generated test fails at it, then restore it.
10. Only then add operations, concurrency, or async work.

The starter key-value spec is a complete minimal example: `assets/starter/ExampleState.cs`, `assets/starter/ExampleSpec.cs`, and `assets/starter/ExampleTests.cs`. Read them for the shape and adapt to the user's domain and types. Don't copy them in verbatim.

## Load when the task matches
Read the whole file before starting that part of the task. Where two files cover one topic, the first is the task guide and the second the deeper explanation:
- Designing state, nested state, supported property types → [reference/state.md](reference/state.md)
- State that holds images, blobs, or other large data (`[SharedState]`, seeded random data) → [reference/modeling-large-data.md](reference/modeling-large-data.md)
- Writing operations, class-based operations, `Expect.That`, `Expect.OneOf`, exception expectations → [reference/operations.md](reference/operations.md)
- Failure messages that don't say why a response was rejected (`ValidationResult`, FluentAssertions) → [reference/better-error-messages.md](reference/better-error-messages.md)
- Inputs, `GenerateTests` options, coverage algorithms, running tests, visualizing the state graph → [reference/test-generation.md](reference/test-generation.md)
- Resetting the system between generated tests (`BeforeEachAsync` strategies) → [reference/resetting-state.md](reference/resetting-state.md)
- Binding to a network API (HTTP client, `ApiResult<T>`), server-generated IDs, common error-handling patterns → [reference/patterns.md](reference/patterns.md)
- Requests that need values from an earlier response (`Derive.From`, `.When`, `.As`, `.AsVariants`, templates) → [reference/request-derivations.md](reference/request-derivations.md)
- Timeouts, dropped connections, fault injection, outcomes you can't know for sure → [reference/indefinite-failures.md](reference/indefinite-failures.md)
- Race conditions, concurrent tests, linearizability, `MaxConcurrencyLevel` → [reference/concurrency.md](reference/concurrency.md)
- Background jobs, `.Triggers`, polling, liveness → [reference/async-operations.md](reference/async-operations.md), then [reference/step-functions.md](reference/step-functions.md) for terminating and non-terminating step functions
- How `spec.Allows` and state profiles check responses, hand-written conformance tests → [reference/conformance-testing.md](reference/conformance-testing.md)
- System that can't be called from .NET, validating recorded traces, exporting JSON test plans to a runner in another language → [reference/testing-any-system.md](reference/testing-any-system.md)
- Explaining why a spec isn't a fake, or a user wants to reuse an existing fake as the spec → [reference/models-vs-fakes.md](reference/models-vs-fakes.md)
- Changing an existing spec, or a spec that throws or starts rejecting traces it used to accept (trace databases) → [reference/validating-your-model.md](reference/validating-your-model.md)
- A failing or flaky spec, state mismatches, too many or zero generated tests → [reference/troubleshooting.md](reference/troubleshooting.md)
- Finding, redirecting, or reading test logs, HTTP diagnostic logging → [reference/test-logs.md](reference/test-logs.md)
- Quick syntax lookup for an API you already understand → [reference/quickref.md](reference/quickref.md)
- Updating the bundled upstream text, or the license terms for it → [NOTICE.md](NOTICE.md)

Full docs: <https://microsoft.github.io/accordant>. API reference: <https://microsoft.github.io/accordant/api/>. Samples (BankAccount, TodoList, Booking, JobQueue): <https://github.com/microsoft/accordant/tree/main/Samples>.

## Before finishing
Review the diff against this list. Fix each miss and re-check until the list is clean:
- [ ] State holds only what predicts responses, and no `ThenState` mutates the `state` argument.
- [ ] Every operation handles its error cases before success, and every `Expect.That` checks the payload and has an explanation.
- [ ] Nondeterminism uses `Expect.OneOf`, not a loosened predicate.
- [ ] Bindings use `BindAsync`. Every `spec.Allows` result is checked. Every poll is bounded.
- [ ] `BeforeEachAsync` resets state with the project's own mechanism and fails loudly when the reset fails, and the package version is pinned.
- [ ] Every Accordant call matches a signature in a reference file.
- [ ] `dotnet test` passes, and a deliberately broken predicate made a generated test fail.
- [ ] Each reference file the task matched was read and applied.
