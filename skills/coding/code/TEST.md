# Writing tests

The structure is right (WRITE.md / REFACTOR.md), so failure paths are
explicit and the edges are clean. Write tests that follow the same contract a
production caller follows. Examples are pseudocode — translate the shape.

## 1. Assert the shape before the payload

When a function returns a Result, don't unwrap. Narrow first — assert the
variant — then inspect the payload.

```
result = parse_port("3000")

// Narrow first — assert the shape before touching the payload
assert(result == Ok(3000))
```

A failure should read "wrong variant", not "test crashed".

## 2. One test per error variant

A workflow's signature promises a union of failures. Cover every variant —
with its payload — not just a generic "it failed."

```
result = parse_port("nope")

assert(result == Err(InvalidPort { input: "nope" }))
```

If `RegisterUserError` has four variants, write four tests.

## 3. Test short-circuiting

Once a workflow step fails, later steps must not run. Assert it.

```
calls = []
save = () -> calls.push("save")

result = workflow(save)   // workflow errors before reaching save()

assert(result is Err)
assert(calls == [], "save() must not run after an early failure")
```

## 4. Test retries deterministically

Inject the operation, keep delays at zero, assert the exact attempt list.
No real sleeping, no flakiness.

```
attempts = []
operation = (attempt) -> {
    attempts.push(attempt)
    return attempt < 3 ? Err(Temporary) : Ok("ready")
}

result = retry(operation, policy = { max_attempts: 2, delay: 0 })

assert(attempts == [1, 2, 3])
assert(result is Ok)
```

## 5. Keep defects separate

Expected failures live in the Result; defects are bugs that panic. Don't test
a bug's panic as a normal result.

```
// Expected failure — assert the error variant
assert(parse_port("nope") is Err)

// Defect — a broken invariant must crash, and that's the point of the test
expect_crash(() -> set_quantity(-5))
```

`expect_crash` is your test framework's "should throw / should panic"
assertion, whatever it's called.

## 6. Helpers fail directly

Test helpers never return errors — they crash, so the test fails for you.
Usage stays a short sequence of steps, not a chain of error checks.

```
// Awkward — every call site needs error checking
fn setup() -> Result<Db, Error> { ... }
db = setup().value_or_crash()   // caller must unpack the error first

// Clean — the helper crashes on failure, failing the test for you
fn setup() -> Db { ... }
db = setup()
```

## 7. Golden files for complex output

Capture a correct run, eyeball it, commit it as the golden file, and compare
future output against it. Don't hand-write brittle per-line assertions for
complex structures (config rendering, serialization, formatted text).

## 8. Pin the important unions at compile time

The compiler is a test runner you already have. Pin a signature so it can't
drift silently, using your language's compile-time type assertion
(TypeScript's `expectTypeOf`, Rust's const coercion, or similar):

```
// Asserts register_user is exactly (str) -> Result<User, RegisterUserError>
type_assert(register_user, fn(str) -> Result<User, RegisterUserError>)
```
