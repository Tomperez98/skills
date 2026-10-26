# Code nobody can test

A change is needed in a function with no tests and a database call in the
middle. code REFACTOR makes it testable without changing behavior, then
`/implement` adds the change.

**You:** I need invoices to round to the currency's minor unit
(yen has none). But `build_invoice` has no tests, and I'm scared of it.

**Agent** _(code: REFACTOR)_:

**1. Diagnose.** `build_invoice` is 140 lines. It reads the customer from
the database, reads `TAX_RATE` from the environment halfway down, and does
the math in between. Two rows in REFACTOR.md's table match:

- IO interleaved with logic → code skill, WRITE.md rule 4
- `getenv` deep in the call stack → code skill, STATE.md rule 2

The first is doing the most damage, since nothing can be tested without a
database. Fixing that one first.

**2. Fix, then test.** I split it in two: `load_invoice_inputs` does the IO,
and a pure `compute_invoice(customer, lines, tax_rate)` does the math. To
prove the behavior didn't change, I kept the old function as a reference
and fed both versions 2,000 generated inputs: empty lines, one line,
duplicates, zero and negative amounts. Every output matched. Then I deleted
the old function and the equivalence test.

`TAX_RATE` now arrives as a parameter, read once at startup. That's the
second row. It was small, so it went in the same change.

**Agent:** `compute_invoice` is pure now, so the rounding change is
straightforward. Type `/implement` with the rounding as the plan.

**You:** `/implement` — round totals to the currency's minor unit.

**Agent** _(implement)_:

**1. Settle the plan.** One open question: do you round per line, or only
the total? Tax law usually fixes this; your invoices today round only the
total. I'll keep that unless you say otherwise.

**You:** total only.

**Agent:**

**2. Cut vertical slices.**

1. USD totals round to 2 places. _Test: 10.005 → 10.01._
2. JPY totals round to 0. _Test: 1000.5 → 1001._
3. An unknown currency is an expected failure, not a crash. _Test:
   `XYZ` → `Err(UnknownCurrency)`._

**3–6.** Each slice went red on the missing rounding, then green, then got
a commit. In slice 3, `UnknownCurrency` returns an error value, since the
currency comes from user input (code skill, WRITE.md rule 2).

Done: three commits, suite green. Type `/review`.
