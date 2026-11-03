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
into "that won't happen." Rule 8 says whose bug each assertion catches:
the caller's (precondition) or yours (postcondition).

Write the panic message for the person who reads it: name the invariant and
the value that broke it — `"quantity must be positive, got {q}"`, not
`"assertion failed"`. A specific panic tells the reader which bug it is; a
cryptic one becomes a support ticket. An `unwrap()` is an assert with no
message: write `expect("config was validated at startup")` instead.

**Let the panic reach the top.** A `catch` that swallows a panic and keeps
going turns the crash at the exact line back into the cascade it stopped.
Fix a defect in the code, not at runtime. A catch-all at a unit-of-work
boundary (a request handler, a job loop) may log and abandon that unit, but
never resume it on the state the panic left (CRASHONLY.md rule 3).

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

**Returned means visible in the contract.** A caller must be able to see the
failure from the signature — a `Result`/`Either`, a tagged union, a nullable, or
a checked exception — and be made to handle it. A language that checks
exceptions makes a declared `throws` a returned value; a language that does not
makes a raised error returned only when its type and the fact that it can be
raised are part of the documented contract and callers handle it. An error that
surfaces only at runtime, invisible in every signature between its source and
the caller, is an implicit exception (REFACTOR.md rule 1), not a returned value.

**Handle every returned failure.** When the caller ignores a returned error,
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
preconditions (rule 8).

**Check and extract in one step.** A test followed by a forced unwrap is a
panic the compiler can't see: the next edit moves the use away from the
check. Match, narrow, or destructure so the value exists only on the branch
where it is valid:

```
// Wrong — check and use drift apart
if user.is_some() { greet(user.unwrap()) }

// Right — the value exists only where it's present
if let Some(u) = user { greet(u) }
```

**Write the error for the person who has to act on it.** A returned error is
a message to a caller — or to you, three months later, at 2 a.m. Say what
failed, which value did it, and what to do next: `"host 'api.example.com'
unreachable: retry, or check --region"`, not `"EIO"`. A cryptic error moves
the debugging cost onto every caller; a helpful one pays for itself on the
first incident.

## 3. Parse at the edge

Parse raw input once, at the boundary, and pass meaningful domain values
inward. Inner functions trust the parsed type.

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
keep driver and framework error types behind the boundary.

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
edge. Match the union once; keep HTTP codes out of the domain.

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

## 8. State the contract; substitute only what keeps it

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

Where the contract lives: the types first (rule 3 here, SHAPE.md rule 7), then
asserts at entry and exit, then a comment for anything the types can't hold.
TEST.md rule 10 proves it.

## 9. Bound everything

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
  counter or a deadline (CRASHONLY.md rule 6).
- **Avoid recursion, or give it an explicit depth limit.** A loop over an
  explicit stack is usually better, because the stack's size is a number
  you can bound and check.
- **Keep control flow local.** Steer normal logic with returns, not `goto`,
  `setjmp`/`longjmp`, or thrown exceptions. A reader should see every way
  out of a function inside it: a return or a panic.
- Use fixed-width types (`u32`, `i64`) over architecture-specific ones
  (`usize`, `int`) — the bound is visible in the type.
- **Overflow is a bug until you say otherwise.** Use checked arithmetic
  (`checked_add` returns `None`/`Err` instead of wrapping) and return the
  failure where overflow is an expected case.
- **Allocate at startup, not after.** Size pools, buffers, and caches once at
  init, from config, and reuse them. Running out of preallocated space is
  hitting a bound: return the failure or panic, following the one rule. Keep the
  buffer its original size. In a garbage-collected language the rule becomes:
  every collection that grows has a cap.

## 10. Turn every warning into an error

The compiler and the static analyzer can catch a bug before the code ever
runs, which makes them the earliest crash you have. Let them fail the build.

- **Use the strictest settings from the first commit:**
  your compiler's strictest mode, its warnings-as-errors flag, and the
  linter's strict ruleset. Turning strictness on later means working
  through a backlog first. Turning it on at the start costs nothing.
- **Keep the count at zero.** A warning that stays becomes noise, and noise
  hides the next real warning. Fix it, or suppress it on that one line with
  a comment saying why.
- **Justify every escape hatch on its line.** `unsafe`, `any`, a cast,
  `# type: ignore`, and `@ts-expect-error` each switch a check off. Prefer
  a rewrite that needs none. Where one must stay, comment the invariant
  that makes it correct (Rust's `// SAFETY:` convention) and wrap it behind
  an interface that callers can't misuse.
- **Match every variant, with no wildcard arm.** Make the incomplete-match
  check an error and skip the catch-all `_`: when someone adds a variant,
  the compiler lists every match that needs a decision. Where you handle
  only some variants, write the rest out by name and panic on them (rule 1),
  so the gap is deliberate and a reader sees it.
- **Simplify code the tool can't follow.** When the analyzer can't prove the
  code safe, rewrite the code until it can instead of silencing the tool.
  If a tool can't reason about the code, a reviewer probably can't either.
- **Gate the merge on it.** Run the compiler and analyzers in CI's fast tier
  (ship skill, CI.md rules 2 and 7). To set that up, load the "ship" skill
  and follow its CI.md.

## Done when

- Every expected failure is a returned value the signature shows, and every
  call site handles, propagates, or visibly discards it (rule 2).
- Every broken invariant or precondition panics at its line, with a message
  that names the value that broke it, and no handler resumes after one
  (rules 1 and 8).
- Raw input is parsed once, at the edge, into typed values (rule 3).
- Errors are translated once per boundary: no driver error type or
  transport code reaches the domain (rules 5 and 7).
- Every loop, queue, and recursion has a named bound, and the strict build
  reports zero warnings (rules 9 and 10).
