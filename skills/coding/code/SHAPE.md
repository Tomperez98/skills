# Shape and structure

You're designing an interface, naming things, adding an abstraction, or
splitting a function. The goal is a surface a caller can guess and a body a
reviewer can read whole. Apply the rules in order. The examples are
pseudocode, as in [WRITE.md](WRITE.md).

## 1. Minimize the interface surface; name the fault model

An interface is a contract. Keep its surface small — fewer methods, fewer
parameters — and document not just what it returns but what it can fail with.
That fault model is WRITE.md rule 5 seen from the interface side: the caller
handles the named failures and nothing else. Every implementation must keep that
contract (WRITE.md rule 8).

Shape the surface so a caller can guess it:

- **A few nouns, a few verbs, one pattern.** Name every operation
  `Noun` + `Verb` (`OrderCreate`, `OrderCancel`), so the next operation is
  predictable and a gap or a duplicate stands out.
- **One operation, one request type, one response type.** Give each
  operation one job, whatever its arguments; two jobs are two operations
  (rule 3).
- **Closed enums for lifecycle and outcomes.** A reader sees every state an
  object can be in, and every expected outcome (`created`, `duplicate`,
  `expired`, `absent`) comes back as a named value, not a boolean or a
  string to parse.
- **Compose by wrapping, not copying.** A request that includes another
  operation's input carries that request instead of redeclaring its fields,
  so each concept is defined once.
- **Make misuse hard.** Required parameters over ordered optional ones, distinct
  types for ids that look alike (STATE.md rule 4), enums instead of booleans.
- **Hide what callers don't need.** Storage layout and internal states stay
  behind the interface, so they can change without a breaking change
  (WRITE.md rule 8).
- **State which operations are safe to repeat.** Idempotency is part of the
  contract: a retry returns the original result or a named `duplicate`,
  never a second effect or an unnamed error.

Push control flow up and data flow down — callers decide, leaves compute.
Abstract a non-deterministic physical interface (network, clock, disk)
behind a deterministic logical one, so the caller and the test see a stable
contract instead of the machine.

## 2. Boundaries and seams, judiciously

- Test only the exported/public API unless a function is extremely complex;
  treat unexported internals as implementation details.
- Use interfaces (interfaces, protocols, traits, abstract types) as seams to
  swap a real dependency for a fake at test time — sparingly: every
  interface adds indirection.

A seam belongs at a boundary that actually varies at test time — a network
call, a clock, a queue — not on every function. Put the interface where the
real dependency lives, and let the function that does the work take it as a
parameter:

```
// The interface is the seam; the function doesn't know which side it's on
interface RateSource { fn quote(pair: Pair) -> Result<Rate, RateError> }

fn convert(amount: Money, pair: Pair, rates: RateSource) -> Result<Money, RateError> {
    rate = rates.quote(pair)?
    return Ok(amount * rate)
}

// Test: a fake RateSource, no network call, no mocking framework
fake_rates = FakeRateSource(pair: Pair("USD", "EUR"), rate: 0.9)
assert(convert(100, Pair("USD", "EUR"), fake_rates) == Ok(90))
```

`convert` doesn't know it's talking to a fake — the seam is one parameter, and
the fake is a plain value, not a mock library standing in for a method call. Add
the seam only when a second implementation is real (rule 5) — a fake for tests
counts — not on every internal helper, where it's one more layer between the
reader and the code that does the work.

## 3. Minimize branches at the call site

Every case the caller must handle is a test someone has to write. Simplify
signatures so the call site branches as little as possible, and return the
simplest type that answers the question. A `bool` beats a count, a count
beats a nullable — and the simplicity propagates through the call graph.

```
fn is_ready() -> bool { ... }              // caller: one branch
fn find_user(id) -> Option<User> { ... }   // caller: one match
fn classify(x) -> enum { A, B, C }         // caller: three matches — is that the point?
```

**Declare every variable in the smallest scope that works.** Put it inside
the loop or branch that uses it, not at the top of the function or on a
shared object. The shorter the gap between where a value is set and where
it's read, the fewer lines can change it and the fewer states a test has
to cover.

```
// Wide — `total` is visible and mutable for the whole function
let total = 0
// ... 30 lines ...
for item in cart { total += item.price }

// Narrow — born where it's used
let total = sum(item.price for item in cart)
```

## 4. Name for the mental model

Names are the mental model; make them carry it.

- Append qualifiers to a base name (`user_id`, `user_name`, `user_email`).
- Sort by the most significant word first (big-endian): `revenue_total`,
  not `total_revenue` — related names group and line up.
- Give related names the same length so they align in the source
  (`source` / `target`).
- Use your language's prevailing case convention — `snake_case`,
  `camelCase`, `PascalCase`, whatever the codebase already uses — and don't
  abbreviate: a crisp name beats a short one.

## 5. Solve the problem before you abstract

Write the functionality first and make it work. A class hierarchy, a plugin
interface, or a dispatch layer doesn't solve anything by itself. It's a
structure you then have to write the real program inside, and conform to
from then on.

- Start with the plainest dispatch that works: an `if` or a `switch` that
  picks the behavior.
- Add indirection (a function pointer, an interface, a registry) only when
  a *concrete* need shows up: a second real implementation, a test seam
  (rule 2), a measured cost. "We might
  need it later" is not a concrete need.
- Keep the abstraction as small as that need. Build only what
  today's problem needs.

```
// first: the real work, plain dispatch
if mode == Mode.Vim { vim_keys(event) } else { default_keys(event) }

// later, only if a real third mode or plugin API shows up
handlers[mode](event)
```

Every layer you don't add is one fewer place for a contract to hide. The
functions that do the work stay in plain view, where their failures are
easy to see and easy to test.

## 6. Keep functions short

A function should fit on one screen, with a hard limit of about 60–70
lines. A reviewer who can see the whole function can check its contract;
one who has to scroll only checks it in pieces. A short function also has a
small contract, with few inputs and few failures, so it's cheap to test.

- **Split by role, not at line 60.** Keep the branching in the parent and
  move loops and computation into leaf helpers (rule 1: control flow up,
  data flow down). The parent then reads as the decision, and each leaf
  does one job with no branches of its own.
- **Name each piece for what it does.** If a helper can only be called
  `step_two`, the split is in the wrong place.
- **Split down to the natural size and stop.** A one-use helper that saves three
  lines is one more jump for the reader to follow (rule 5).

## 7. Let the type hold the guarantee

Pick the collection whose guarantees match the data. A type that can
represent less guarantees more, and every guarantee the type holds is a
check you don't write, test, or get wrong.

```
// List: uniqueness is a check you maintain by hand
out = []
for c in conns[user] {
    for u in conns[c] {
        if u != user && u not in out { out.append(u) }
    }
}

// Set: uniqueness is the type's job
out = set()
for c in conns[user] { out |= conns[c] }   // union
out -= {user}                              // difference
```

- **Set:** unique, unordered. Because it rules out duplicates and order,
  union and membership can be much faster than a list scan. On large
  inputs the gap can reach orders of magnitude, even counting the
  list-to-set conversion.
- **Bag** (multiset, counter): duplicates, no order.
- **Ordered set:** order, no duplicates.
- **List:** order and duplicates. Use it when the data needs them.

The choice also documents intent. In a codebase that uses both, a set says
"unique, unordered" and a list says "order or duplicates matter." Convert to the
guaranteeing type at the edge (WRITE.md rule 3) so inner code can rely on it.

Know your language's set semantics before relying on them. Some compare
members by identity, not value:

```
// JavaScript
s = new Set(); s.add([1]); s.add([1])   // two members: different identities
s.has([1])                               // false
```

## Done when

- The interface names its failures and keeps its surface to one pattern:
  one operation, one request type, one response type (rule 1).
- Seams exist only where a second implementation is real (rules 2 and 5).
- Call sites branch as little as the answer allows, and each variable lives
  in its smallest scope (rule 3).
- Names follow the codebase's case convention, unabbreviated, with
  qualifiers after the base name, most significant word first (rule 4).
- Every function fits on a screen and does one named job, and each
  collection's type holds the guarantee its data needs (rules 6–7).
