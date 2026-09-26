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

## 7. Arrange config by value, not by environment

Config is a value (WRITE.md), so tests pass it in. Setting a variable
mutates process-wide state for every test in the process: leaked values make
tests order-dependent, and nothing runs in parallel.

```
// Wrong — process-wide mutation, restored in a finally, tests serialized
env_set("DATABASE_URL", "postgres://test")
try { assert(connect() is Ok) } finally { env_unset("DATABASE_URL") }

// Right — the value is an argument; the test owns it completely
assert(connect(url = "postgres://test") is Ok)
```

To test the environment-to-config seam itself, hand the parser the
environment as an argument — don't set a variable and hope it is restored.

```
config = parse_config(args = [], env = { "DATABASE_URL": "postgres://test" })
assert(config.url == "postgres://test")

// The failure case is just another input value
assert(parse_config(args = [], env = {}) == Err(Missing("DATABASE_URL")))
```

## 8. Golden files for complex output

Capture a correct run, eyeball it, commit it as the golden file, and compare
future output against it. Don't hand-write brittle per-line assertions for
complex structures (config rendering, serialization, formatted text).

## 9. Pin the important unions at compile time

The compiler is a test runner you already have. Pin a signature so it can't
drift silently, using your language's compile-time type assertion
(TypeScript's `expectTypeOf`, Rust's const coercion, or similar):

```
// Asserts register_user is exactly (str) -> Result<User, RegisterUserError>
type_assert(register_user, fn(str) -> Result<User, RegisterUserError>)
```

## 10. Test that startup is recovery

Recovery is the only startup path, so it must rebuild every invariant from
durable state alone. Kill the component mid-write — no cleanup, no
destructors — then restart it and assert the state is sound.

```
store.set("a", 1)
store.crash()                    // just stop; no flush, no finalizers

restarted = Store.open(path)     // open IS recover
assert(restarted.get("a") in [Ok(1), Ok(absent)])   // rebuilt or dropped, never corrupt
```

Because this is the only startup path, this test exercises exactly what
production runs every boot — recovery can't rot in the dark.

## 11. Test idempotency by double-applying

Restart/retry is only sound when re-running an effect applies it once. Pin
that property: apply a retryable operation twice and assert the single
effect.

```
key = new_idempotency_key()
apply_payment(key, 100)
apply_payment(key, 100)          // the "retry" after a crash

assert(balance_delta == 100)     // applied once, not twice
```

The idempotency key (or sequence number) is what makes the retry safe; the
test is what makes that safety explicit and non-negotiable.

## 12. Test cancellation before release

Asynchronous cancellation is a protocol: the caller may release the
resources in-flight work touches only *after* the worker acknowledges.
Assert that ordering — the ack fires before the release.

```
events = []
worker = spawn(() -> { use(buffer); events.push("worker_done") })

shutdown(worker)              // must not return until the worker acked
events.push("released")

assert(events == ["worker_done", "released"])
```

If `shutdown` returned early and the caller freed the buffer while the
worker still read it, this test fails with a data race — the exact bug the
protocol exists to prevent.

## 13. Test a refactor against the original

A refactor promises identical behavior, so hold it to that. Keep the old
implementation as the reference and assert that the new one agrees on every
input you can generate.

```
fn old_should_fail(x, y) { return !((x && y) || !x) }
fn new_should_fail(x, y) { return x && !y }

// Few Boolean inputs: enumerate the whole truth table
for x in [true, false] {
    for y in [true, false] {
        assert(new_should_fail(x, y) == old_should_fail(x, y),
               "differs at x={x} y={y}")
    }
}
```

- **Small Boolean domain: test every combination.** `n` inputs means `2ⁿ`
  cases; up to a dozen or so inputs, check them all.
- **Large domain: generate inputs.** Use a property-testing library to feed
  both versions random inputs, including empty collections and duplicates,
  and compare the results (the "oracle" shape in "Test the contract as
  properties").
- **Compare effects, not just values.** If the code has side effects,
  record calls (as in "Test short-circuiting") and assert both versions
  produce the same sequence. A rewrite that reorders `f() && g()` can pass
  a value check and still change behavior.

Once the refactor lands, delete the old implementation and its equivalence
test. They've done their job.

## 14. Test the contract as properties

An example test checks one input. A property test states the contract
(WRITE.md: state the contract) once, and a library such as Hypothesis, fast-check,
proptest, or QuickCheck checks it against hundreds of generated inputs.
Generate only inputs that meet the precondition. A precondition violation
is a bug, so it belongs in `expect_crash` ("Keep defects separate"), not
here.

```
property(xs: nonempty_list<int>) {
    m = max(xs)
    assert(m in xs)                       // postcondition, part 1
    assert(all(m >= x for x in xs))       // postcondition, part 2
}
```

Shapes that find bugs:

- **Postcondition or invariant.** For any valid input, the result is `Ok`
  and meets the postcondition, or it is one of the named errors. It never
  crashes.
- **Round-trip.** `parse(render(x)) == Ok(x)`, the check for WRITE.md's
  "parse at the edge".
- **Oracle.** The result matches a slow but obviously correct version, or
  the original code during a refactor ("Test a refactor against the
  original").
- **Split and combine.** If `f(xs ++ ys) == combine(f(xs), f(ys))`, then
  `f([])` must be the identity of `combine`. That is why `all([])` is
  `true`, `any([])` is `false`, and `sum([])` is `0`. Assert the empty case
  explicitly. If an empty input should be rejected, reject it at the edge,
  because `all(valid(x) for x in xs)` passes on `[]`.
- **Same properties, every implementation.** Run the same property suite
  against each implementation of an interface and against the new version
  of an API. That is how you check "requires no more, promises no less".

Make the generators include empty collections, single elements,
duplicates, and boundary numbers. When a property fails, keep the shrunk
counterexample as a plain example test, so it stays pinned. Fix the seed
in CI, or log it, so a failure can be replayed.

## 15. Test every row of the decision table

A decision table (WRITE.md: tabulate multi-input decisions) is already a
test plan. Write one
case per row, and add one test that proves the table itself is complete and
unambiguous: enumerate every combination of inputs and assert that exactly
one row matches.

```
rows = [
    ({member: true,  big: ANY,   region: Domestic}, Free),
    ({member: false, big: true,  region: Domestic}, Free),
    ({member: false, big: false, region: Domestic}, Flat),
    ({member: ANY,   big: ANY,   region: Intl},     ByWeight),
]

for (inputs, expected) in rows {
    assert(shipping(inputs) == expected)          // one case per row
}

for combo in product([true, false], [true, false], [Domestic, Intl]) {
    assert(count(r for r in rows if matches(r, combo)) == 1,
           "gap or overlap at {combo}")
}
```

A gap or an overlap fails at the input that causes it, before a customer
finds it.
