# Refactoring untestable code

The code is hard to test. Diagnose which structural principle it violates,
fix that first, and the tests write themselves; a mock only treats the
symptom.

Hard-to-test code is usually complex code. A small, simple program is easy
to change and easy to test, and every structure you add is paid for from
then on. The refactor's real job is often deletion: remove the structure
doing the least work. The diagnosis below names which one that is.

## 1. Diagnose

Find the symptom the code shows, and read the rule that fixes it:

| Symptom | Fix |
|---------|-----|
| IO interleaved with logic | WRITE.md rule 4 |
| Raw input re-validated deep inside | WRITE.md rule 3 |
| Failures thrown across frames, invisible in signatures; returned errors ignored | WRITE.md rule 2 |
| Driver or framework error types reach the domain | WRITE.md rule 5 |
| An operation's steps scattered, its failure space written nowhere | WRITE.md rule 6 |
| HTTP statuses inside domain logic | WRITE.md rule 7 |
| No one can say what a function requires or promises; a substitute breaks callers | WRITE.md rule 8 |
| Unbounded loops, recursion, queues, or allocation | WRITE.md rule 9 |
| Warnings ignored or the analyzer silenced | WRITE.md rule 10 |
| Globals leak between tests | STATE.md rule 1 |
| `getenv` deep in the call stack | STATE.md rule 2 |
| A whole `App` or entity graph passed for one field; `a.b.c.d` chains | STATE.md rule 3 |
| Cached object references serve stale data | STATE.md rule 4 |
| Uniqueness or references checked in app code, then written | STATE.md rule 5 |
| An interface with too many methods and undocumented failures | SHAPE.md rule 1 |
| No way to swap a dependency for a fake | SHAPE.md rule 2 |
| A fat return type every caller must match; wide variable scope | SHAPE.md rule 3 |
| Abbreviated or inconsistently ordered names | SHAPE.md rule 4 |
| Hierarchies or plugin layers built before a concrete need | SHAPE.md rule 5 |
| A function longer than a screen, mixing decisions with work | SHAPE.md rule 6 |
| Hand-rolled search or dedup loops | LOGIC.md rule 1, SHAPE.md rule 7 |
| Nested or negated conditions that re-check a proven fact | LOGIC.md rule 1 |
| A multi-input decision no one can list | LOGIC.md rule 2 |
| Checks and asserts inside the hot loop | PERFORMANCE.md rule 3 |
| Shutdown relies on self-cleanup; a separate untested fresh-start path | CRASHONLY.md rules 1–3 |
| A retry double-applies an effect | CRASHONLY.md rule 4 |
| A call blocks forever or a resource is never released | CRASHONLY.md rule 6 |

Pick the one doing the most damage and fix it first. Most often that's IO
interleaved with logic, raw input deep inside, or implicit exceptions.

## 2. Fix, then test

Refactor so the code follows the rule the diagnosis named, preserving
external behavior. Make one behavior-preserving rewrite at a time, and
rewrite conditions logically when they're side-effect-free (LOGIC.md
rule 1).

Prove each rewrite against the original. Keep the old implementation as the
reference and assert that the new one agrees on every input you can
generate.

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
- **Large domain: generate inputs.** Feed both versions random inputs,
  including empty collections and duplicates, and compare the results (the
  oracle shape in TEST.md rule 10).
- **Compare effects, not just values.** If the code has side effects,
  record calls (as in TEST.md rule 3) and assert both versions produce the
  same sequence. A rewrite that reorders `f() && g()` can pass a value
  check and still change behavior.

Once the refactor lands, delete the old implementation and its equivalence
test. Then write the tests the new structure makes possible: see
[TEST.md](TEST.md).

**Match the effort to the task.** A refactor is done when the violation you
named is gone and the external behavior is preserved — not when the
subsystem is perfect. Prefer the smallest change that removes the dominant
violation, prove it against the original, and stop. Golden recordings,
contract suites, and mutation checks earn their cost when the risk and the
request justify them; a test framework around a function nobody asked
you to harden does not.

## 3. Treat pain as a signal

If a test is still painful to write after the refactor, the structure still
violates one of the rules above. Loop back to step 1.

## Done when

- The violation doing the most damage is named from the table (rule 1).
- That violation is gone, and an equivalence test shows external behavior
  is unchanged (rule 2).
- The tests the new structure allows are written, and each runs on real
  values, with no mock standing in for structure (rules 2–3).
