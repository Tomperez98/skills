# Writing tests

The structure is right (WRITE.md / REFACTOR.md), so failure paths are
explicit and the edges are clean. Write tests that follow the same contract a
production caller follows. Examples are pseudocode — translate the shape.

Test crash recovery, idempotency, or cancellation →
[CRASH_TESTS.md](CRASH_TESTS.md).

## 1. Assert the shape before the payload

When a function returns a Result, narrow first: assert the variant, then
inspect the payload.

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

Once a workflow step fails, later steps stop running. Assert it.

```
calls = []
save = () -> calls.push("save")

result = workflow(save)   // workflow errors before reaching save()

assert(result is Err)
assert(calls == [], "save() must not run after an early failure")
```

## 4. Test retries deterministically

Inject the operation, keep delays at zero, assert the exact attempt list.
Time stays virtual, so the test is deterministic.

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

Expected failures live in the Result; defects are bugs that panic. Assert a
defect's panic with `expect_crash`, and a failure's variant with the Result.

```
// Expected failure — assert the error variant
assert(parse_port("nope") is Err)

// Defect — a broken invariant must crash, and that's the point of the test
expect_crash(() -> set_quantity(-5))
```

`expect_crash` is your test framework's "should throw / should panic"
assertion, whatever it's called.

## 6. Helpers fail directly

Test helpers crash on failure, so the test fails for you. Usage stays a short
sequence of steps, not a chain of error checks.

```
// Awkward — every call site needs error checking
fn setup() -> Result<Db, Error> { ... }
db = setup().value_or_crash()   // caller must unpack the error first

// Clean — the helper crashes on failure, failing the test for you
fn setup() -> Db { ... }
db = setup()
```

## 7. Arrange config by value, not by environment

Config is a value (STATE.md rule 2), so tests pass it in. Setting a variable
mutates process-wide state for every test in the process: leaked values make
tests order-dependent and serialize the run.

```
// Wrong — process-wide mutation, restored in a finally, tests serialized
env_set("DATABASE_URL", "postgres://test")
try { assert(connect() is Ok) } finally { env_unset("DATABASE_URL") }

// Right — the value is an argument; the test owns it completely
assert(connect(url = "postgres://test") is Ok)
```

To test the environment-to-config seam itself, hand the parser the
environment as an argument.

```
config = parse_config(args = [], env = { "DATABASE_URL": "postgres://test" })
assert(config.url == "postgres://test")

// The failure case is just another input value
assert(parse_config(args = [], env = {}) == Err(Missing("DATABASE_URL")))
```

The same principle is the whole suite's. A test that owns all its state runs
in any order, in parallel, and shards across machines; one that leaks state
into its neighbors can't. Name the wall-clock budget the suite must fit,
and fix state that leaks between tests as a bug: at a hundred pulls a day
the suite's speed is the merge queue's speed.

## 8. Expect tests for complex output

For complex results, render any observable outcome as stable text and let
the runner write the expected output. That outcome can be a return value or
error payload, a trace of calls or events, or a rendered form (config,
serialization, formatted text, a DOM tree, a query plan, CLI output). Start
with an empty expectation, run the test, read the diff, and accept it only
when the output is right. A later change to the code then shows up as a diff
in the frozen output. Use whatever inline expectation or snapshot support
your test runner already has.

The text must be deterministic and readable by eye. If you can't tell
whether it is right, the expectation only freezes what the code does today.

```
test "order book after two bids" {
    book = new_book()
    book.add(Bid, price = 10, size = 5)
    book.add(Bid, price = 11, size = 2)

    print_book(book)
    expect("""
        BID  11 x 2
        BID  10 x 5
    """)
}
```

- **Keep the expectation next to the code that prints it,** inline or in
  a file beside the test. The scenario and its result read together, and
  the output doubles as an example of the function's use.
- **Print a story, not a dump.** Write a small printer that shows the
  state that matters and elides the rest, on a small example. A raw dump
  buries the point and changes for reasons no one cares about.
- **Use several expectations in one scenario** to show state after each
  step, so a diff points at the step that changed.
- **Read every diff before accepting it.** Accepting is one keystroke, so
  an unread acceptance turns the test into noise. A diff in an existing
  expectation is a regression until you have judged it.
- **Normalize values that change every run** (IDs, timestamps, ordering)
  before comparing, or judge the output against rules instead: an
  expectation that passes on every correct run keeps its meaning.

An expect test captures output you never thought to assert on, so it
catches changes a hand-written assertion misses. It is not stronger than
an assertion, though. Use assertions (rules 1–2) for a narrow contract, such
as one variant or one payload, and properties (rule 10) for a rule that must
hold on every input. This fits output whose exact text is the contract, and a
suite whose diffs a person reads. A change that rewrites hundreds of
expectations at once is too large to review: split the change, or assert
the contract instead.

## 9. Pin the important unions at compile time

The compiler is a test runner you already have. Pin a signature so it can't
drift silently, using your language's compile-time type assertion:

```
// Asserts register_user is exactly (str) -> Result<User, RegisterUserError>
type_assert(register_user, fn(str) -> Result<User, RegisterUserError>)
```

## 10. Test the contract as properties

An example test checks one input. A property test states the contract (WRITE.md
rule 8) once, and a property-testing library checks it against hundreds of
generated inputs. Generate
only inputs that meet the precondition; a precondition violation is a bug, so
test it in `expect_crash` (rule 5).

```
property(xs: nonempty_list<int>) {
    m = max(xs)
    assert(m in xs)                       // postcondition, part 1
    assert(all(m >= x for x in xs))       // postcondition, part 2
}
```

Shapes that find bugs:

- **Postcondition or invariant.** For any valid input, the result is `Ok`
  and meets the postcondition, or it is one of the named errors, and it
  returns either way.
- **Round-trip.** `parse(render(x)) == Ok(x)`, the check for parsing at the
  edge (WRITE.md rule 3).
- **Oracle.** The result matches a slow but obviously correct version, or
  the original code during a refactor (REFACTOR.md rule 2).
- **Split and combine.** If `f(xs ++ ys) == combine(f(xs), f(ys))`, then
  `f([])` must be the identity of `combine`. That is why `all([])` is
  `true`, `any([])` is `false`, and `sum([])` is `0`. Assert the empty case
  explicitly. If an empty input should be rejected, reject it at the edge,
  because `all(valid(x) for x in xs)` passes on `[]`.
- **Simulate the clock and the network.** Put time and transport behind an
  interface (WRITE.md rule 8) and give tests a fake that delays, drops, or
  reorders messages on command. Runs are fast and deterministic, and a
  failure replays from its seed. Feed the same state machine random event
  orders (a property) or fuzzer bytes. Test new *combinations* of old code:
  reuse hides failure modes the old callers never hit.
- **Same properties, every implementation.** Run the same property suite
  against each implementation of an interface and against the new version
  of an API. That is how you check "requires no more, promises no less".

Make the generators include empty collections, single elements,
duplicates, and boundary numbers. When a property fails, keep the shrunk
counterexample as a plain example test, so it stays pinned. Fix the seed
in CI, or log it, so a failure can be replayed.

## 11. Prove the test can fail (kill the mutant)

A suite earns trust once you have watched it go red. A test is
valuable only if it fails when the code is wrong, so inject a bug on
purpose and confirm the suite catches it. If the suite still passes, it is
blind — the mutation *survived*.

```
// The suite is green. Now make it prove it can fail.
mutant = patch(recovery -> restore_oldest_snapshot)   // a realistic defect
result = run_suite(mutant)

assert(result == Caught, "suite survived the mutant — the test is blind")
```

Choose the mutation to match the level of the test:

- **Unit tests: a mechanical mutation is enough.** Flip a comparison, swap
  a signed operator, force a branch, delete a statement. A mutation-testing
  tool for your language can enumerate these for you.
- **System, property, and end-to-end tests: inject a semantic bug.**
  Mechanical mutations panic or short-circuit and never reach the deep path the
  test exists to exercise. Pick one that keeps
  the common case working and breaks only a rare interleaving (restore an
  older snapshot, skip a dedup key on retry, drop a write during failover).
  It does not have to be hidden; it has to be *reached*.

Read the result as one of three outcomes, and only the first one is a pass:

- **Caught** — the suite failed at the broken assertion. The test is real.
- **The bug never ran** — the suite failed elsewhere, or not at all, because
  the mutant was never exercised. Inconclusive, not a pass: broaden the
  inputs, or inject the fault (network partition, crash, disk error) that
  the path needs.
- **The bug ran and nothing noticed** — a true survivor. Either the test
  does not reach that path or does not assert the property: strengthen the
  workload, the assertion, or the fault configuration, and retry. If it
  still survives, the property itself may be unfalsifiable — take it to
  someone who can say whether it is a theorem or a typo.

This is rule 10's properties, turned on the suite: a passing property test means
nothing until you have seen it fail. Cap the budget — a handful of mutants and
runs, not an afternoon — and stop when new survivors stop teaching you anything.
Mutants are ephemeral: revert each one before you commit. They are calibration;
the test is the artifact.

## Done when

- Every error variant in the signature has its own test, which asserts the
  variant before the payload (rules 1–2).
- A workflow's tests show later steps don't run after an early failure, and
  retry tests assert the exact attempt list with zero delay (rules 3–4).
- Each expect test prints a small, focused output, and you read its diff
  before accepting it (rule 8).
- Each property test's generators include empty, single, duplicate, and
  boundary inputs, and each shrunk counterexample is kept as an example
  test (rule 10).
- The suite went red on at least one injected mutant, and no mutant is left
  in the code (rule 11).
