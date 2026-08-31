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
into "that won't happen."

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

## 9. Load only the state you need

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

## 10. Boundaries and seams, judiciously

- Test only the exported/public API unless a function is extremely complex;
  treat unexported internals as implementation details.
- Use interfaces (interfaces, protocols, traits, abstract types) as seams to
  swap a real dependency for a fake at test time — sparingly: every
  interface adds indirection.

## 11. Overflow is a bug until you say otherwise

Fail on integer overflow rather than silently wrapping. If overflow is an
expected case, handle it explicitly:

```
total = checked_add(a, b)   // returns None/Err on overflow instead of wrapping
```

When something unrecoverable happens, crash and let a supervisor restart —
crash-only recovery, rather than limping on in a corrupted state.

## 12. Own memory centrally: handles, not pointers

The fail-fast rule applies to ownership, not just invariants. A dangling
pointer is a bug — detect it at the moment it would do damage, not after
silent corruption.

```
let handle = world.spawn(Enemy)   // returns a Handle<Enemy>, not a pointer
let enemy  = world.lookup(handle) // panics if the handle is stale
enemy.take_damage(10)             // never store `enemy` beyond this block
```

- **Centralize ownership.** Allocation and deallocation live in a few central
  systems (rendering, physics, animation, …) that are the sole owners of
  their memory. User code never calls the allocator directly.
- **Group like items into arrays.** Items of the same type are packed in
  arrays; the array base pointer stays private to the owning system. Cache
  locality, no per-item allocation, easy leak detection, reallocation without
  invalidating references.
- **Return index-handles, not pointers.** The public API hands out a small
  index (a handle), never a pointer to the item. A pointer is never the owner
  of an item's memory.
- **Spend spare handle bits on safety.** A 16-bit handle that needs only 10
  index bits has 6 spare bits — put a generation counter in them. On
  handle→pointer conversion, compare the handle's generation against the
  slot's current generation; a mismatch is a dangling access, so crash there.
- **Bump the generation on release.** Each slot's counter increments when its
  handle is released; on overflow, disable the slot so no new handle can
  collide with one still in the wild.
- **Convert rarely, never store.** A pointer obtained from a handle is a
  short-lived reference: use it in one block, never store it, never pass it
  across function calls.

The handle lookup is where the fail-fast contract lives: a handle either
resolves to the item it was created for, or the generation mismatch panics at
the lookup line — use-after-free becomes a loud crash instead of silent
corruption.
