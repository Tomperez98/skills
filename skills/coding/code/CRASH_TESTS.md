# Testing crash-only behavior

You're testing a component that claims crash-only behavior
([CRASHONLY.md](CRASHONLY.md)): it recovers on start, retries safely, and
cancels cleanly. Write each test against the claim it pins. Examples are
pseudocode — translate the shape.

## 1. Test that startup is recovery

Recovery is the only startup path, so it must rebuild every invariant from
durable state alone. Kill the component mid-write (skip cleanup and
destructors), then restart it and assert the state is sound.

```
store.set("a", 1)
store.crash()                    // just stop; no flush, no finalizers

restarted = Store.open(path)     // open IS recover
assert(restarted.get("a") in [Ok(1), Ok(absent)])   // rebuilt or dropped, never corrupt
```

This test exercises exactly what production runs every boot, so recovery
stays exercised.

## 2. Test idempotency by double-applying

CRASHONLY.md rule 4 makes a retryable effect idempotent; pin that property.
Apply the operation twice with the same key and assert the single effect.

```
key = new_idempotency_key()
apply_payment(key, 100)
apply_payment(key, 100)          // the "retry" after a crash

assert(balance_delta == 100)     // applied once, not twice
```

## 3. Test cancellation before release

Asynchronous cancellation is a protocol: the caller releases the
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

## Done when

- Every crash-only claim has its test: restart after a kill, double-apply,
  ack before release (rules 1–3).
- The restart test kills without cleanup and asserts the rebuilt state is
  sound or dropped, never corrupt (rule 1).
- Every retryable operation has a double-apply test asserting one effect
  (rule 2).
- Each cancellation path asserts the worker's ack precedes the release
  (rule 3).
