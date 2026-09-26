# Writing new code

You're writing a function, API, or feature. The goal is a signature that is
its own contract: it either returns one of its documented failures, or it
guarantees its invariants hold. Apply the rules in order.

The examples are pseudocode. `Result<Value, Error>` means "success carries a
`Value`, failure carries an `Error`"; `Ok`/`Err` are its two cases. Whatever
your language calls these — a tagged union, `Either`, `Try`, a nullable, a
checked error — translate the *shape*, not the syntax.

## 1. Panic on broken invariants

A broken invariant is a bug. Crash on it, at the exact line.

```
// A negative quantity is a bug — fail loudly
fn set_quantity(q: int) {
    assert(q > 0, "quantity must be positive, got {q}")
    // ...
}
```

Sprinkle `assert` wherever an assumption is clever or load-bearing. Stop
running the moment it stops holding — assertions turn "that can't happen"
into "that won't happen." Rule 24 says whose bug each assertion catches:
the caller's (precondition) or yours (postcondition).

```
let adult = generate_adult()
assert(adult.age >= 18)
sell_item_to(adult)
```

## 2. Return a value for expected failures

Failure the caller should handle is a value, not a crash:

- Network errors, file I/O.
- Parsing and validating user input.
- Business rules that can legitimately be rejected.

```
// Reading a config file can legitimately fail — hand the error back
fn read_config(path: str) -> Result<Config, IOError> {
    // ... each step returns a Result; the first failure propagates up
}
```

Unsure which camp a failure belongs in? Ask: *"is this a bug, or an expected
outcome?"* Bugs panic; expected outcomes return.

**Never drop a returned failure.** If the caller ignores a returned error,
the error disappears and the program carries on as if the call worked.
That is worse than a panic. Every returned failure is handled, propagated,
or discarded where a reader can see it:

```
// Wrong — the Result is dropped; a failed write looks like a saved file
write(file, buf)

// Right — handled, or discarded on purpose
match write(file, buf) {
    Err(e) -> return Err(SaveFailed(e))
    Ok(_)  -> {}
}
_ = log.flush()   // best-effort: dropping the error is deliberate
```

Make the compiler enforce it with `#[must_use]`, `[[nodiscard]]`,
`errcheck`, or `no-floating-promises`. The other half of the check lives
with the function being called: it asserts its own parameters as
preconditions (rule 21).

## 3. Parse at the edge

Parse raw input once, at the boundary, and pass meaningful domain values
inward. Don't re-validate strings and shapes in every function.

```
fn handle_create_user(raw: str) -> Result<User, Error> {
    command = parse_create_user(raw)  // boundary: raw -> domain; failure propagates
    return register_user(command)     // everything inside trusts the value
}
```

`parse_create_user` absorbs the validation; the functions it calls receive a
`CreateUser`, not a pile of untyped input.

## 4. Isolate side effects

Extract the purely functional core out of IO handlers. Push IO to the edges;
gather the logic into one pure place.

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

`KeyEncoder` — the part doing the real work — is now a pure unit. Throw
arbitrary inputs at it without mocking a mouse or terminal.

## 5. One error vocabulary per boundary

Each layer speaks its own error language. Translate once at the boundary;
don't leak driver/framework error types into the domain.

```
fn find_user(id: UserId) -> Result<User, UserError> {
    row = query_user_row(id)          // DbError on failure
    if row is NoRows:    return Err(UserError.NotFound(id))
    if row is other_err: return Err(UserError.StoreUnavailable(other))
    return Ok(to_user(row))
}
```

Callers of `find_user` handle two meaningful cases, not a pile of database
exceptions.

## 6. Compose in a workflow

Put an operation's steps in one workflow whose return type records every
expected failure. The signature documents the whole failure space.

```
fn register_user(input: str) -> Result<User, RegisterUserError> {
    command = parse_create_user(input)       // InvalidCreateUser
    ensure_email_available(command.email)    // EmailTaken
    user = insert_user(command)              // UserStoreUnavailable
    publish_user_registered(user)            // PublishFailed
    return user
}
```

Each step can fail with its own error; the workflow short-circuits on the
first failure, and the return type documents all four.

## 7. Map to transport once

Translate the result into the transport response in exactly one place, at the
edge. Match the union once; don't scatter HTTP codes through the domain.

```
fn to_http_response(result: Result<User, RegisterUserError>) -> Response {
    match result {
        Ok(user)                     -> 201, json(user)
        Err(InvalidCreateUser(e))    -> 400, json(e)
        Err(EmailTaken(e))           -> 409, json(e)
        Err(UserStoreUnavailable(_)) -> 503, "try again"
        Err(PublishFailed(_))        -> 503, "try again"
    }
}
```

## 8. Tame global state

Prefer a configuration option with a default over a global. Tests override
the option without touching process-wide state.

```
DEFAULT_PORT = 1000

struct ServerOpts {
    port: int   // default it to DEFAULT_PORT somewhere
}
```

## 9. Configure explicitly, at the edge

Environment variables are global state with extra steps: ambient, untyped,
and invisible in every signature that depends on them. A `getenv` deep in
the call stack is a hidden input — the function lies about what it needs,
and only the environment reveals the truth. Prefer TigerBeetle's shape:
config arrives as explicit arguments at the entry point, is validated once
into a typed value, and is passed down.

```
// Wrong — an ambient lookup far from the entry point; the signature hides it
fn connect() -> Result<Conn, IOError> {
    url = env("DATABASE_URL") ?? panic("missing")   // untyped, late, global
    // ...
}

// Right — read the environment once, at the edge, into a typed value
fn main() -> Result<(), Error> {
    config = parse_config(args, env)   // the only read; failure is loud and early
    return serve(config)               // everything inside takes Config, not the world
}

fn connect(url: DbUrl) -> Result<Conn, IOError> { ... }
```

- **Read the environment once, at the edge — `main` or the CLI parser.**
  Below that line, no `getenv`. Every layer receives the parsed value as an
  argument; the parser takes the environment as a parameter rather than
  reaching into the process, so a test can drive it directly.
- **Validate into a type at that boundary.** A missing or malformed value
  is a startup failure that names the offender, not a wrong answer three
  hours in. A typo'd variable silently falling back to a default is the
  classic production incident; `getenv` returning null is the bug.
- **No silent defaults for required config.** A default that is safe in
  development is a latent bug in production: it turns a typo'd variable
  name into a wrong answer instead of a crash. An option's default is
  visible in the type (rule 8); an environment variable's is invisible.
  Require the value, and let the crash name what is missing.
- **Pass the narrowest slice each component needs** — a `DbUrl`, not the
  whole `Config` (rule 10).

The environment is a legitimate *boundary*, not a config store. systemd,
Kubernetes, and CI hand a process its world as variables; TigerBeetle's own
unit converts `TIGERBEETLE_*` into explicit `--flags` before the binary
starts, and the binary itself reads no environment config. Read it there —
at the seam — and nowhere else.

## 10. Load only the state you need

Give a function the narrowest slice of state its logic touches — not a
reference to the whole world. A handler that reads one field shouldn't
receive the entire `App`, `Context`, or `Database`.

```
// Too wide — depends on everything the app owns
fn handle_checkout(app: App, cart_id: CartId) -> Result<Receipt, Error> {
    // ... reaches into app.db, app.tax_rates, app.shipping ...
}

// Narrow — declares exactly what it needs
fn handle_checkout(db: CartDb, tax: TaxRates, cart_id: CartId) -> Result<Receipt, Error> {
    // ... only what the handler uses is in scope
}
```

In a webserver, load only the state a request needs: query the rows it
reads, don't hydrate the whole entity graph or pull every table. A narrow
state surface means a narrow failure space, and a test that builds one small
value instead of standing up the whole app.

Reach one hop, not four. A chain like `order.customer.account.address.city`
depends on four objects that the signature never mentions. Each hop can be
null, and each is something a test has to build. Pass in the value the
function needs, or ask the nearest object for it (the Law of Demeter).

```
// Reaches through the object graph
fn shipping_zone(order: Order) -> Zone { zone_of(order.customer.account.address.city) }

// Takes what it uses
fn shipping_zone(city: City) -> Zone { zone_of(city) }
```

## 11. Boundaries and seams, judiciously

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

`convert` doesn't know it's talking to a fake — the seam is one parameter,
and the fake is a plain value, not a mock library standing in for a method
call. This is the same boundary DEPENDENCIES.md wraps a vendor behind
(wrap it behind one boundary); the difference is only which side owns the
interface. Add the seam only when a second implementation is real (rule
18: solve the problem before you abstract) — a fake for tests counts — not
on every internal helper, where it's one more layer between the reader and
the code that does the work.

## 12. Overflow is a bug until you say otherwise

Fail on integer overflow rather than silently wrapping. If overflow is an
expected case, handle it explicitly:

```
total = checked_add(a, b)   // returns None/Err on overflow instead of wrapping
```

When something unrecoverable happens, crash and let a supervisor restart —
crash-only recovery, rather than limping on in a corrupted state. Making
that crash safe and the recovery fast is its own branch — see
[CRASHONLY.md](CRASHONLY.md).

## 13. Pass identity, not references

Across a boundary, hand out an ID or token — not a reference to the object.
A reference is a snapshot that silently goes stale; an ID is re-resolved, and
the lookup is where staleness gets caught.

```
// Wrong — the caller caches the object, which rots and pins memory
let user = db.get(user_id)
cache.set("user", user)              // stale data served later

// Right — store the ID; resolve it fresh at the edge
cache.set("user_id", user_id)
let user = db.get(cache.get("user_id"))   // fresh, or a loud miss
```

- **Pass IDs across boundaries, not hydrated objects.** The core receives
  `user_id`, not a `User`; callers re-resolve when they need data.
- **Cache IDs, not objects.** A cached object pins memory and rots; a cached
  ID re-resolves fresh.
- **Fail fast on stale identity.** Version the thing (etag, row version,
  `updated_at`); a mismatch at the boundary is a loud `404`/`409`, not a
  silently overwritten change.

*Systems translation: "handles with generation counters instead of
pointers." The lookup compares the generation and panics on a stale handle —
same shape: identity plus a staleness check, resolved in one place.*

Once the structure is fail-fast and testable, speed is a separate concern
with its own branch — see [PERFORMANCE.md](PERFORMANCE.md) for keeping the
hot path free of indirection, sketching costs before you build, and
splitting the control plane from the data plane.

## 14. Bound everything

Everything has a limit; write it down. Bound loops, queues, buffers,
concurrency, and recursion. A bound is a fail-fast device — when the code
hits a limit that "can't happen," it panics at that line instead of
hanging, ballooning, or looping forever. When hitting the limit *can*
happen, it's an expected failure, so return it.

```
MAX_REDIRECTS = 10          // a server can send a redirect loop: expected

fn fetch_following(url: Url) -> Result<Response, FetchError> {
    for _ in 0..MAX_REDIRECTS {
        response = fetch(url)
        if !response.is_redirect { return Ok(response) }
        url = response.location
    }
    return Err(TooManyRedirects(url))
}

MAX_DEPTH = 64              // our own tree deeper than this is a bug

fn root_of(node: Node) -> Node {
    for _ in 0..MAX_DEPTH {
        if node.is_root { return node }
        node = node.parent
    }
    panic("tree deeper than MAX_DEPTH")
}
```

- **Every loop has a named upper bound**: a constant, or the length of the
  collection it walks. A `while true` that waits for a condition gets a
  counter or a deadline (CRASHONLY.md: timeout every interaction).
- **Avoid recursion, or give it an explicit depth limit.** A loop over an
  explicit stack is usually better, because the stack's size is a number
  you can bound and check.
- **Keep control flow local.** No `goto`, no `setjmp`/`longjmp`, and no
  exceptions thrown to steer normal logic. A reader should see every way
  out of a function inside it: a return or a panic.
- Use fixed-width types (`u32`, `i64`) over architecture-specific ones
  (`usize`, `int`) — the bound is visible in the type.
- **Allocate at startup, not after.** Size pools, buffers, and caches once
  at init, from config, and reuse them. Running out of preallocated space
  is hitting a bound: return the failure or panic, following the one rule.
  Don't grow the buffer. In a garbage-collected language the rule becomes:
  every collection that grows has a cap.

## 15. Minimize branches at the call site

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

## 16. Minimize the interface surface; name the fault model

An interface is a contract. Keep its surface small — fewer methods, fewer
parameters — and document not just what it returns but what it can fail
with. That fault model is "one error vocabulary per boundary" seen from the
interface side: the caller handles the named failures and nothing else.
Every implementation must keep that contract (rule 21).

Push control flow up and data flow down — callers decide, leaves compute.
Abstract a non-deterministic physical interface (network, clock, disk)
behind a deterministic logical one, so the caller and the test see a stable
contract instead of the machine.

## 17. Name for the mental model

Names are the mental model; make them carry it.

- Append qualifiers to a base name (`user_id`, `user_name`, `user_email`).
- Sort by the most significant word first (big-endian): `revenue_total`,
  not `total_revenue` — related names group and line up.
- Give related names the same length so they align in the source
  (`source` / `target`).
- Use your language's prevailing case convention — `snake_case`,
  `camelCase`, `PascalCase`, whatever the codebase already uses — and don't
  abbreviate: a crisp name beats a short one.

## 18. Solve the problem before you abstract

Write the functionality first and make it work. A class hierarchy, a plugin
interface, or a dispatch layer doesn't solve anything by itself. It's a
structure you then have to write the real program inside, and conform to
from then on.

- Start with the plainest dispatch that works: an `if` or a `switch` that
  picks the behavior.
- Add indirection (a function pointer, an interface, a registry) only when
  a *concrete* need shows up: a second real implementation, a test seam
  (see "Boundaries and seams, judiciously"), a measured cost. "We might
  need it later" is not a concrete need.
- Keep the abstraction as small as that need. Don't build a framework to
  head off a problem you don't have yet.

```
// first: the real work, plain dispatch
if mode == Mode.Vim { vim_keys(event) } else { default_keys(event) }

// later, only if a real third mode or plugin API shows up
handlers[mode](event)
```

Every layer you don't add is one fewer place for a contract to hide. The
functions that do the work stay in plain view, where their failures are
easy to see and easy to test.

## 19. Write conditions as logic

A condition is a Boolean formula, and formulas have rewrite rules that keep
their value: De Morgan, distribution, double negation. Apply one rule per
step and the behavior can't change. A simpler condition has fewer branches
for a reader to follow and a test to cover (rule 15).

```
// Before
if !((x && y) || !x) { do_thing() }

// After: distribution, x || !x is true, De Morgan, double negation
if x && !y { do_thing() }
```

- **Don't re-check what a branch already proved.** Inside `if P`, `P` is
  true; inside its `else`, `P` is false.

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
  any clause changes state, isolate the effect first (rule 4), then
  rewrite.
- **The operator exists.** Most languages have no implication (`=>`).
  Filter instead: `all(Q(x) for x in xs if P(x))` means
  "for all `x`, `P(x) => Q(x)`".

Switch between code and formula as needed; for hard cases, pen and paper
or a symbolic solver (such as sympy) is faster. Then prove the rewrite
changed nothing: see TEST.md, "Test a refactor against the original".

*Rules 19–20 adapt Hillel Wayne, Logic for Programmers, ch. 3.*

## 20. Let the type hold the guarantee

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
"unique, unordered" and a list says "order or duplicates matter." Convert
to the guaranteeing type at the edge (rule 3) so inner code can rely on it.

Know your language's set semantics before relying on them. Some compare
members by identity, not value:

```
// JavaScript
s = new Set(); s.add([1]); s.add([1])   // two members: different identities
s.has([1])                               // false
```

## 21. State the contract; substitute only what keeps it

A contract has three parts, and each part says whose bug a violation is:

- **Precondition:** what the caller must supply. A violation is the
  caller's bug, so assert it at entry.
- **Postcondition:** what you promise on return, including the named
  failures in the `Result`. A violation is your bug, so assert it before
  you return.
- **Invariant:** what holds before and after every call. Rule 1 guards it.

```
// pre:  xs != []                       (caller's bug → panic)
// post: result in xs && all(result >= x for x in xs)   (our bug → panic)
fn max(xs: list<int>) -> int { ... }

// Expected failures belong to the postcondition, not the precondition
// post: Ok(u) with u.email == normalize(raw.email), or Err(EmailTaken | InvalidEmail)
fn register_user(raw: CreateUser) -> Result<User, RegisterUserError> { ... }
```

A substitute can be a subclass, a second implementation of an interface,
or the next version of your API. It is safe only if it **requires no more
and promises no less**:

| Change | Why | Safe? |
|--------|-----|-------|
| Accept a wider input, add an optional parameter | weaker precondition | yes |
| Stop returning one error variant | stronger postcondition | yes |
| Reject input that used to be accepted (tighter validation) | stronger precondition | **breaking** |
| Add an error variant to the returned union | weaker postcondition: callers' matches miss a case | **breaking** |
| Remove or loosen a field in the result | weaker postcondition | **breaking** |

The classic failure is `Square` inheriting from `Rect`. `Rect.set_width(w)`
promises that the height is unchanged, and a `Square` can't keep that
promise, so it isn't a `Rect`. Fix it with separate types, or with
immutable shapes that have no setters to break.

Where the contract lives: the types first (rules 3 and 20), then asserts at
entry and exit, then a comment for anything the types can't hold. TEST.md,
"Test the contract as properties", proves it.

## 22. Tabulate multi-input decisions

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
  missing combination is a missing requirement, so ask about it; don't
  guess.
- **Unambiguous:** no combination matches two rows with different
  outcomes. An overlap is a contradiction in the requirements.

Then code it from the table, as one branch per row or as a lookup. Each row
is one test (TEST.md, "Test every row of the decision table"). A condition
with fewer inputs is still logic: see rule 19.

## 23. Let the store enforce data invariants

A check in application code guards one code path. A constraint in the
store guards every writer: other services, migrations, a script someone
runs by hand, and two requests racing each other. Declare data invariants
in the schema, so a broken invariant fails at the write.

```
CREATE TABLE users (
  id     BIGINT PRIMARY KEY,
  email  TEXT   NOT NULL UNIQUE,
  age    INT    NOT NULL CHECK (age >= 0),
  org_id BIGINT NOT NULL REFERENCES orgs(id)
);
```

- **Check-then-write races.** `if !exists(email) { insert(user) }` lets two
  requests insert the same email. `UNIQUE` doesn't. Keep the application
  check if you want a friendlier error, but treat the constraint as the
  guarantee.
- **Rules that span several rows or tables:** use a trigger or an exclusion
  constraint if your store has one. Otherwise, derive the value in a view
  instead of storing a copy that can drift.
- **Map the violation once, at the boundary (rule 5).** A violation that
  user input can cause, such as a duplicate email, is an expected failure,
  so return `Err(EmailTaken)`. A violation that only your code can cause,
  such as a foreign key to a row you just created, is a bug, so panic.
- **Test the constraint directly.** Write the bad row with raw SQL, skipping
  your code, and assert the store rejects it. Otherwise nothing proves the
  constraint exists.

*Rules 21–23 cover the topics of Logic for Programmers chs. 5, 7, and 8
(contracts and subtyping, database theory, decision tables), using standard
Design by Contract, Liskov substitution, and decision-table practice.*

## 24. Keep functions short

A function should fit on one screen, with a hard limit of about 60–70
lines. A reviewer who can see the whole function can check its contract;
one who has to scroll only checks it in pieces. A short function also has a
small contract, with few inputs and few failures, so it's cheap to test.

- **Split by role, not at line 60.** Keep the branching in the parent and
  move loops and computation into leaf helpers (rule 16: control flow up,
  data flow down). The parent then reads as the decision, and each leaf
  does one job with no branches of its own.
- **Name each piece for what it does.** If a helper can only be called
  `step_two`, the split is in the wrong place.
- **Don't split below the natural size.** A one-use helper that saves three
  lines is one more jump for the reader to follow (rule 18).

## 25. Turn every warning into an error

The compiler and the static analyzer can catch a bug before the code ever
runs, which makes them the earliest crash you have. Let them fail the build.

- **Use the strictest settings from the first commit:**
  `-Wall -Wextra -Werror -pedantic`, TypeScript `strict`, `mypy --strict`,
  Clippy with `-D warnings`. Turning strictness on later means working
  through a backlog first. Turning it on at the start costs nothing.
- **Keep the count at zero.** A warning that stays becomes noise, and noise
  hides the next real warning. Fix it, or suppress it on that one line with
  a comment saying why.
- **Simplify code the tool can't follow.** When the analyzer can't prove the
  code safe, rewrite the code until it can instead of silencing the tool.
  If a tool can't reason about the code, a reviewer probably can't either.
- **Gate the merge on it.** Run the compiler and analyzers in CI's fast tier
  (ship skill, CI.md rules 2 and 7).
