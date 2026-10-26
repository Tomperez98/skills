# Conditions and decisions

You're writing a branchy condition or a decision over several inputs. The
goal is the fewest branches that keep the behavior, with every input
combination accounted for. Apply the rules in order. The examples are
pseudocode, as in [WRITE.md](WRITE.md).

## 1. Write conditions as logic

A condition is a Boolean formula, and formulas have rewrite rules that keep
their value: De Morgan, distribution, double negation. Apply one rule per
step and the behavior can't change. A simpler condition has fewer branches
for a reader to follow and a test to cover (SHAPE.md rule 3).

```
// Before
if !((x && y) || !x) { do_thing() }

// After: distribution, x || !x is true, De Morgan, double negation
if x && !y { do_thing() }
```

- **Check each fact once.** A branch has already proved what it tests. Inside
  `if P`, `P` is true; inside its `else`, `P` is false.

  ```
  if P || !Q { body1 }
  else if Q && R { body2 }   // in this else, Q is already true
  // becomes
  else if R { body2 }
  ```

- **A search loop is a quantifier.** Write `any` / `all`.

  ```
  // Before
  for s in servers { if s.status == Offline { return true } }
  return false

  // After
  return any(s.status == Offline for s in servers)
  ```

- **Fewer quantifiers, one pass.** `!all(P) || any(!Q)` is
  `any(!P || !Q)`: one loop instead of two. Move any term that doesn't
  depend on the loop variable outside the quantifier.

  ```
  // Before: `a.chunks` doesn't depend on `df`
  if !all(!a.chunks || len(a.chunks[0]) == df.parts for df in dfs) { fail() }

  // After
  if a.chunks && any(len(a.chunks[0]) != df.parts for df in dfs) { fail() }
  ```

- **Name the negation away.** Prefer `!=` over `!(==)`, and
  `wrong_password(p)` over `!correct_password(p)`, but only when the new
  name is obvious.
- **Keep the normal case in the `if`.** Swapping branches to drop a
  top-level `!` preserves behavior. Do it only if the reader still sees
  the expected case first.

Programs are not math. The rules hold only when:

- **The condition is pure.** Evaluating `f(x)` may mutate `x`, so
  `x == [] && f(x) && x != []` isn't necessarily false. Short-circuiting
  means `g() && f()` can run different side effects than `f() && g()`. If
  any clause changes state, isolate the effect first (WRITE.md rule 4), then
  rewrite.
- **The operator exists.** Most languages have no implication (`=>`).
  Filter instead: `all(Q(x) for x in xs if P(x))` means
  "for all `x`, `P(x) => Q(x)`".

Switch between code and formula as needed; for hard cases, pen and paper
or a symbolic solver (such as sympy) is faster. Then prove the rewrite
changed nothing (REFACTOR.md rule 2).

## 2. Tabulate multi-input decisions

When the outcome depends on several inputs at once, write the decision as a
table before you write the code. List the inputs as columns, each case as a
row, and `-` for "doesn't matter".

```
member | total >= 50 | region   || shipping
-------+-------------+----------++---------
yes    | -           | domestic || free
no     | yes         | domestic || free
no     | no          | domestic || flat
-      | -           | intl     || by_weight
```

Check the table before you code it:

- **Complete:** every combination of inputs matches a row. Count them: 2 ×
  2 × 2 = 8 combinations here, and the rows cover 2 + 1 + 1 + 4 = 8. A
  missing combination is a missing requirement, so ask about it
  instead of guessing.
- **Unambiguous:** no combination matches two rows with different
  outcomes. An overlap is a contradiction in the requirements.

Then code it from the table, as one branch per row or as a lookup. A
condition with fewer inputs is still logic: see rule 1.

The table is already a test plan. Write one case per row, and add one test
that proves the table itself is complete and unambiguous: enumerate every
combination of inputs and assert that exactly one row matches.

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

## Done when

- Each rewritten condition is one rule application per step (rule 1).
- A test compares each rewritten condition with the original (rule 1).
- Every multi-input decision has a table that is complete and unambiguous,
  with one test per row and one gap-or-overlap test (rule 2).
