---
name: code
description: >
  Write code that fails fast and can be tested well. Covers the fail-fast
  philosophy (crash early on programmer errors and broken invariants, return
  Result/Option for expected failures, assertive programming, crash-only
  recovery) and the testability work that flows from it (isolating side
  effects, parsing at the edge, modeling errors as values, one error
  vocabulary per boundary, composing workflows, taming global state,
  interfaces as seams) plus the testing techniques that become available once
  the structure is right (golden files, fail-direct test helpers, asserting
  discriminated shapes, covering every error variant, short-circuiting,
  deterministic retries, compile-time tests). Use this skill whenever the
  user writes code or tests, asks for help testing something, says code is
  hard to test or untestable, refactors code so it can be tested, designs
  APIs or functions and cares about correctness or testability, or asks about
  mocking, error handling, panics, assertions, or test strategy — even if
  they never say "testability" or "fail fast" out loud.
---

# Writing code that fails fast and tests well

Software has two kinds of problems: the ones you *expect* and handle, and
the ones that mean your program has drifted into a state that *should be
impossible*. The first kind you model as values; the second kind you crash
on, loudly and immediately. That split — **bugs panic, expected failures
return values** — is the thread that ties failing fast and designing for
testability together, and it's the foundation of this skill.

The two sides reinforce each other. Fail-fast code is easier to test because
its contract is explicit: a function either returns one of its documented
failures, or it guarantees its invariants hold. And testable code fails fast
by construction, because modeling errors as values and pushing messy parts to
the edges is exactly what makes a system crash early instead of limping along
with bad data.

The examples use Rust and TypeScript idioms (`Result`, unions, `assert!`,
`matches!`) but every principle is language-agnostic — apply the *shape* in
whatever language you're working in. The one rule that ties the whole thing
together:

> **Bugs panic, expected failures return values.**

---

## Part 1 — Fail fast

Before you can test a system, it has to fail in a way you can reason about.
Fail-fast is the discipline of crashing the moment an assumption stops
holding, rather than letting a crippled program keep running on bad data.

### Crash early

> **The Pragmatic Programmer: Crash Early.** A dead program normally does a
> lot less damage than a crippled one.

When your program hits an invalid state, fail *loudly*. Stop running and make
it obvious that something went wrong, instead of limping along with bad data.
An error that blows up in your face is much harder to miss than one buried in
a log file. Logs help, but a crash makes sure everyone notices.

### Debugging gets easier

If you keep going after an invalid state, you no longer know where things
went wrong. Now you have to reproduce the bug, step through code, and hunt
for the exact point where the program drifted off course. Failing fast tells
you exactly where execution stopped — that's usually most of the work.

### Avoid cascading failures

Letting a program continue after an invalid state means letting it wander
into unknown territory. One bad state leads to another, and small problems
snowball into much bigger ones. Stopping early keeps a small mistake small.

### Simpler mental models

"Failing safe" means adding branches for every possible bad path — more code
paths to juggle, and more chances to get it wrong. Failing fast means you can
assume the system is in the state you expect. Once you've ruled out
unexpected states, you can reason about your code with confidence.

### Assertive programming

*Assertive programming* is a whole methodology built on fail-fast (it comes
from *The Pragmatic Programmer*). Sprinkle `assert!` calls through your code
to continuously check the system's state, and crash the moment an assumption
stops holding.

```rust
let adult = generate_adult();
assert!(adult.age >= 18);
sell_item_to(&adult);
```

The `assert!` after `generate_adult()` guarantees that execution only reaches
line 3 when `adult.age >= 18`. You might think "that can never fail" — and
you're probably right. But assertions are cheap insurance: they turn "that
can't happen" into "that won't happen".

Assertive programming shines when your code is clever and error-prone:

```rust
fn some_crazy_calculation_that_returns_a_positive_number(num: i32) -> i32 {
    // do something clever with num
    num + 1 // placeholder logic
}

for i in 0..total {
    let a = some_crazy_calculation_that_returns_a_positive_number(i);
    assert!(a > 0); // I don't fully trust my crazy calculation yet
    do_something_with(a);
}
```

Assertions are ultimately a confidence tool: they let you validate
assumptions as you code and build robust, fail-fast systems.

### When to panic vs. return a `Result` or `Option`

The rule of thumb for real code:

**Use panics for programmer errors and broken invariants. Use
`Result`/`Option` for expected, recoverable failures.**

A panic is appropriate when the program has entered a state that *should be
impossible* — in other words, a bug:

- A broken invariant (a value that must always hold, like "quantity is
  positive").
- Incorrect API usage or logic errors.
- Arithmetic that would silently produce a wrong result.

```rust
// A negative quantity is a bug — fail loudly
fn set_quantity(q: i64) {
    assert!(q > 0, "quantity must be positive, got {q}");
    // ...
}
```

An error result is appropriate when failure is *expected* and the caller
should decide how to handle it:

- Network errors and file I/O.
- Parsing and validation of user input.
- Business rules that can legitimately be rejected.

```rust
// Reading a config file can legitimately fail — hand the error back
fn read_config(path: &str) -> Result<Config, std::io::Error> {
    let contents = std::fs::read_to_string(path)?;
    // ...
    Ok(config)
}
```

### Handle overflow explicitly

Rust panics on integer overflow in debug builds, which is exactly the
fail-fast behavior you want. When you need to handle overflow as an expected
case instead, be explicit about it:

```rust
// Debug builds: panics on overflow (fail fast by default)
let total = a + b;

// Explicit handling when overflow is a real possibility
let total = a.checked_add(b)?; // returns Option<...>
```

In release builds you can even set `panic = "abort"` so a panic ends the
process cleanly, ready to be restarted by a supervisor. That's the
*crash-only* approach: when something unrecoverable happens, restart rather
than limp along in a corrupted state.

---

## Part 2 — Structure for testability

Fail-fast gives you a contract; structure gives you a testing surface. The
shape of your code decides what's testable. Push the messy parts to the
edges, make failures explicit, and the tests stop fighting the code. Apply
these principles when writing new code, and use them as a diagnostic
checklist when refactoring untestable code.

### Isolate side effects

IO event handlers — mouse clicks, keyboard input, network connections — mix
real work with hard-to-reproduce side effects. The trick is to *extract the
purely functional behavior* stuck inside them.

Push the IO to the edges and gather the functional logic into one place:

```
Before — logic and IO interleaved              After — IO outside, logic inside

getMouseState()     -> IO                      getMouseState()     -> IO
checkMouseState()   -> functional              getKeyboardState()  -> IO
getKeyboardState()  -> IO                      readSetting()       -> IO
checkKeyboardState()-> functional              KeyEncoder          -> functional
readSetting()       -> IO                      writeToPty()        -> IO
encodeKey()         -> functional
writeToPty()        -> IO
```

Now the `KeyEncoder` — the part doing the real work — is a pure, testable
unit. You can throw arbitrary inputs at it without mocking a mouse or a
terminal.

### Parse at the edge

Untrusted input is the same kind of impurity as IO. If every function
validates raw strings and shapes on the way in, parsing gets interleaved with
business logic — and every caller re-checks the same shapes.

Parse once, at the boundary, and pass meaningful domain values inward. The
code inside stops asking "is this shape right?" and starts assuming it
already is.

```rust
fn handle_create_user(raw: &str) -> Result<User, Error> {
    let command = parse_create_user(raw)?; // boundary: raw -> domain
    register_user(command)                 // everything inside trusts the value
}
```

`parse_create_user` absorbs all the validation and shape-checking. The
functions it calls receive a `CreateUser`, not a pile of untyped input.

### Make errors explicit

A thrown exception is a side effect of a sneaky kind: invisible in the
function signature, it jumps across stack frames and forces tests to reach
for `try/catch` or `#[should_panic]` just to observe a failure path. You
can't compose failure paths, and you can't see what a function might fail
with just by reading it.

Model errors as *values* instead. `Result<T, E>` makes every expected
failure part of the type, so the signature itself is the contract you test
against.

```rust
fn parse_port(input: &str) -> Result<u16, InvalidPort> {
    input.parse().map_err(|_| InvalidPort { input: input.into() })
}
```

`parse_port` now *promises* which failures are possible. That promise is
exactly what the testing techniques in Part 3 assert against. The split is
the same rule from Part 1: **bugs panic, expected failures return values**.

### One error vocabulary per boundary

Each layer should speak its own error language. A repository's public API
might expose `UserNotFound | UserStoreUnavailable`, while the database
adapter underneath knows only driver specifics — `NoRows`, timeouts,
connection resets. Translate once, at the boundary, and don't let driver or
framework error types leak into the domain.

```rust
fn find_user(id: UserId) -> Result<User, UserError> {
    query_user_row(id).map_err(|cause| match cause {
        DbError::NoRows => UserError::NotFound { id },
        other => UserError::StoreUnavailable { cause: other },
    })
}
```

`UserError` is the domain's vocabulary; `DbError` is the adapter's. Callers
of `find_user` match on two meaningful cases instead of a pile of database
exceptions.

### Compose in a workflow

Put an operation's steps into a single workflow function whose return type
records every expected failure. The signature then documents the whole
failure space — and the test plan falls out of the type.

```rust
fn register_user(input: &str) -> Result<User, RegisterUserError> {
    let command = parse_create_user(input)?;   // InvalidCreateUser
    ensure_email_available(&command.email)?;    // EmailTaken
    let user = insert_user(command)?;           // UserStoreUnavailable
    publish_user_registered(&user)?;            // PublishFailed
    Ok(user)
}
```

`RegisterUserError` is the union of those four variants. Anyone reading the
signature knows exactly what can go wrong — and testing means walking that
union, variant by variant.

### Map to transport once

On the way out, translate the result into the transport response in exactly
one place. Don't scatter HTTP status codes through the domain; match the
union once, at the edge.

```rust
fn to_http_response(result: Result<User, RegisterUserError>) -> Response {
    match result {
        Ok(user) => Response::json(user, 201),
        Err(RegisterUserError::InvalidCreateUser(e)) => Response::json(e, 400),
        Err(RegisterUserError::EmailTaken(e)) => Response::json(e, 409),
        Err(RegisterUserError::UserStoreUnavailable(_)) => Response::json("Try again", 503),
        Err(RegisterUserError::PublishFailed(_)) => Response::json("Try again", 503),
    }
}
```

Parsing in at one edge, mapping out at the other: the domain stays clean,
and the transport's concerns are absorbed by the boundaries.

### Tame global state

Global state complicates testing: it leaks between tests, makes tests
order-dependent, and prevents parallel execution. Minimize it. When you
genuinely need something global, prefer making it a *configuration option*
that defaults to the global value. Tests can then override the option
without touching process-wide state.

```rust
// Not good on its own
const PORT: u16 = 1000;

// Better — a mutable static can be reassigned in tests
static mut PORT: u16 = 1000;

// Best — a configurable option with a default
const DEFAULT_PORT: u16 = 1000;

struct ServerOpts {
    port: u16, // default it to DEFAULT_PORT somewhere
}
```

The mutable static is a last resort — it still shares state across tests,
but tests can at least reset it. Each step up the ladder provides more
isolation.

### Package and function boundaries

Break functionality into packages and functions *judiciously*. Done well it
aids testing and improves organization; overdone it complicates both. It's a
qualitative judgment with no hard formula. The payoff is a clean testing
surface:

- Unless a function is extremely complex, test only the **exported** API.
- Treat unexported functions and structs as implementation details — means
  to an end.
- As long as you test the end, and it behaves within spec, the means don't
  matter.

(An even further position: only write integration or acceptance tests. The
approach here stops short of that: unit tests at the exported-API level
provide fast feedback, while the unexported internals still support
testability by keeping the exported API testable.)

### Interfaces as seams

Interfaces are your mocking points. They let you define *behavior* regardless
of *implementation*, so you can swap a real dependency for a fake at test
time — whether through a custom mocking framework or plain test code.

```rust
trait KeyEncoder {
    fn encode(&self, key: &str) -> String;
}
```

Same caveat as packages: use interfaces judiciously. Every interface adds an
indirection that costs readability, so overdoing it complicates readability
the same way overdoing packages does.

---

## Part 3 — Techniques for testing

The structural work above is what makes these techniques possible. If the
failure paths are explicit and the edges are clean, the tests write
themselves. Use these when writing tests for code that follows Part 2 — and
when the tests are painful, read that as a signal that the code needs Part 2
work first.

### Golden files

Testing complex output doesn't mean hand-writing every assertion. *Golden
files* let you capture the output of a correct run and use it as the
expected result for future runs:

1. Generate the output once.
2. Have a human eyeball it.
3. If it's correct, commit it as the golden file.

From then on, the test compares new output against the committed golden
file. It's a scalable way to test complex structures — config rendering,
serialization, formatted text — without maintaining brittle, hardcoded
expectations by hand.

### Test helpers

Tests get hard to read when every one re-implements the same boilerplate.
Write helpers that make tests easy to write and reduce the mental burden of
understanding each one. The key rule: **never return errors from a test
helper. Fail directly instead.**

```rust
// Awkward — every call site needs error checking
fn setup() -> Result<Db, Error> { ... }

let db = setup().expect("setup failed");

// Clean — the helper panics on failure, failing the test for you
fn setup() -> Db { ... }

let db = setup();
```

By not returning errors, the usage stays concise: the error checking
disappears, and each test reads as a short sequence of steps rather than a
chain of `unwrap`s and `?` operators.

### Assert the discriminated shape

When a function returns a `Result`, don't reach for `unwrap` the moment you
have it. Narrow first — assert the shape, then inspect the payload. The
test should follow the same contract a production caller does: match before
you touch the value.

```rust
let result = parse_port("3000");

// Narrow first — assert the shape before touching the payload
assert!(matches!(result, Ok(3000)));
```

Don't let an `unwrap` panic be the test's verdict. Assert the shape
explicitly, so a failure reads as "wrong variant" — not "test crashed".

### Test every error variant

A workflow's signature promises a union of failures. Cover every variant —
not just a generic "it failed" — so each one's translation and payload are
verified.

```rust
let result = parse_port("nope");

assert!(matches!(
    result,
    Err(InvalidPort { input }) if input == "nope"
));
```

One test per variant. If `RegisterUserError` has four variants, write four
tests. A suite that only ever exercises the happy path plus one error case
is a suite that doesn't know its own contract.

### Test short-circuiting

In a composed workflow, once a step fails, the later steps must not run.
That short-circuit is part of the contract — assert it.

```rust
let called = Cell::new(false);
let save = || { called.set(true); Ok(()) };

let result = workflow(save); // workflow errors before reaching save()

assert!(result.is_err());
assert!(!called.get(), "save() must not run after an early failure");
```

### Test retries deterministically

Retry logic with real delays is a test killer: slow, flaky, and
unrepeatable. Inject the operation, keep delays at zero, and assert the
exact attempt list.

```rust
let attempts = RefCell::new(Vec::new());

let result = try_with_retry(
    |attempt| {
        attempts.borrow_mut().push(attempt);
        if attempt < 3 { Err(Error::Temporary) } else { Ok("ready") }
    },
    RetryPolicy { times: 2, delay: Duration::ZERO },
);

assert_eq!(*attempts.borrow(), vec![1, 2, 3]);
assert!(result.is_ok());
```

You assert *which* attempts happened and what each returned — the policy's
real behavior, not its timing.

### Keep defects separate

Distinguish *expected failures* from *defects*. Expected failures live in
your `Result` union; defects are bugs that should panic. Don't write a test
that treats a bug's panic as a normal result — that blurs the very contract
you're proving.

```rust
// Expected failure — assert the Err variant
assert!(parse_port("nope").is_err());

// Defect — a broken invariant must panic, and that's the point of the test
#[test]
#[should_panic]
fn negative_quantity_is_a_defect() {
    set_quantity(-5);
}
```

`#[should_panic]` is for documenting that a broken invariant crashes.
Expected failures go through `Result` — the same "panic for bugs, `Result`
for expected failures" rule from Part 1.

### Compile-time tests

For typed code, the types themselves are part of the API — and the compiler
is a test runner you already have. Pin the important unions with a
compile-time assertion so a signature can't drift silently.

```rust
// Fails to compile if register_user's failure union drifts from RegisterUserError
const _: fn(&str) -> Result<User, RegisterUserError> = register_user;
```

In TypeScript you'd reach for your repo's type-test convention
(`expectTypeOf` or similar); in Rust the coercion above does the job. Either
way, the type system is doing the asserting.

---

## Applying the skill

**Writing new code:** start from Part 1 — panic on broken invariants and
programmer errors, return `Result`/`Option` for expected failures, and add
assertions wherever an assumption is clever or load-bearing. Then apply Part
2 as you design — extract the functional core from IO, parse at boundaries,
model errors as values with one vocabulary per layer, compose workflows whose
return types document the failure space, map to transport once, keep global
state behind configurable options, and use interfaces as seams sparingly.

**Refactoring untestable code:** run the Part 2 sections as a diagnostic
checklist. Find which principle the code violates (typically: IO interleaved
with logic, raw input parsed deep inside, implicit exceptions, global state)
and fix that first. Then write the tests that the new structure makes
possible.

**Writing tests:** apply Part 3. Prefer golden files for complex output,
helpers that fail directly, shape assertions over `unwrap`, one test per
error variant, short-circuit and retry assertions, and compile-time pins for
the important unions. If a test is painful to write, that's a signal the
code needs Part 2 — don't fight the code with mocks; reshape it. And when a
test catches a broken invariant, remember the contract: that's a defect, so
the right fix is to panic early, not to paper over it with a `Result`.

## Sources

This skill merges two threads: the fail-fast error-handling philosophy and
the testability essay (which draws on Mitchell Hashimoto's "Can we test it?
Yes, we can!" talk, the `better-result` application-patterns and testing
guides, and fail-fast error-handling philosophy). Key references:

- [Fail-fast — tomperez98.github.io](https://tomperez98.github.io/posts/fail-fast/)
- [The benefits of fail-fast systems — Medium](https://medium.com/@denhox/the-benefits-of-fail-fast-systems-dc72a665cfb5)
- [NautilusTrader — Fail-fast principles](https://nautilustrader.io/docs/latest/concepts/architecture/#fail-fast-principles)
- [Can we test it? Yes, we can! — Mitchell Hashimoto](https://www.youtube.com/watch?v=MqC3tudPH6w)
- [Better Result — Application patterns](https://better-result.dev/guides/application-patterns)
- [Better Result — Testing](https://better-result.dev/guides/testing)
