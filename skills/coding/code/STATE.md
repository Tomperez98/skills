# State and configuration

You're reading config, an environment variable, a global, a cache, or a
database schema. The goal is state that is explicit in every signature and
checked where it enters: each function takes the narrowest slice it uses, and
each invariant fails at the write. Apply the rules in order. The examples are
pseudocode, as in [WRITE.md](WRITE.md).

## 1. Tame global state

Prefer a configuration option with a default over a global. Tests override
the option without touching process-wide state.

```
DEFAULT_PORT = 1000

struct ServerOpts {
    port: int   // default it to DEFAULT_PORT somewhere
}
```

## 2. Configure explicitly, at the edge

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
- **Require every config value; a missing one fails at startup and names
  the variable.** Parse it into a type at that boundary, so a malformed
  value fails there too. A typo'd variable that falls back to a
  development default is a wrong answer three hours in instead of a crash
  at boot. An option's default is visible in the type (rule 1); an
  environment variable's is invisible.
- **Pass the narrowest slice each component needs** — a `DbUrl`, not the
  whole `Config` (rule 3).

The environment is a legitimate *boundary*, not a config store. systemd,
Kubernetes, and CI hand a process its world as variables; TigerBeetle's own
unit converts `TIGERBEETLE_*` into explicit `--flags` before the binary
starts, and the binary itself reads no environment config. Read it there —
at the seam — and nowhere else.

## 3. Load only the state you need

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

In a webserver, load only the state a request needs: query the rows it reads,
and leave the rest of the entity graph and the other tables alone. A narrow
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

## 4. Pass identity, not references

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

## 5. Let the store enforce data invariants

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
- **Map the violation once, at the boundary (WRITE.md rule 5).** A violation
  that user input can cause, such as a duplicate email, is an expected failure,
  so return `Err(EmailTaken)`. A violation that only your code can cause, such
  as a foreign key to a row you just created, is a bug, so panic.
- **Test the constraint directly.** Write the bad row with raw SQL, skipping
  your code, and assert the store rejects it. Otherwise nothing proves the
  constraint exists.

## Done when

- Global state is an option with a visible default; tests override it
  without touching process-wide state (rule 1).
- The environment is read once, at the edge, into a typed value; nothing
  below calls `getenv`, and a missing variable fails at startup by name
  (rule 2).
- Every function takes only the state it uses, one hop deep (rule 3).
- Caches and boundaries hold IDs, and a stale ID fails loudly (rule 4).
- Every data invariant is a constraint in the store, and a test writes the
  bad row directly (rule 5).
