# Crash-only design

You're making a component safe to crash and fast to recover. The one rule
says bugs panic; this branch makes the panic cheap. A crash-only component
has exactly one way to stop — crash — and exactly one way to start —
recover. Before you write any stop path, name which way you're stoppingx.

## Ways to stop

A component stops in more ways than the one rule names. Conflating them is a
bug source — the wrong shutdown path either leaks resources or races. Name
the mechanism first:

- **Synchronous cancellation** — control flow: unwind the stack and run
  cleanup (`defer`, `finally`, RAII). "Return a value" and "panic" are both
  this. → WRITE.md.
- **Asynchronous cancellation** — a protocol: one party *requests*
  cancellation, then *waits for acknowledgment* before it may release the
  resources the work was using. Freeing a buffer while a worker still reads
  it is a data race; and a worker deep in a SIMD loop can't check a flag per
  byte, so split the work into chunks and check between them. → rules 6–7
  below, plus the ordering note at the end of this section.
- **Graceful shutdown** — stop accepting new work, drain in-flight work to
  completion. Useful for rolling upgrades, but it's a second stop path: if
  you can survive a `kill -9`, you can implement "Quit" by killing yourself.
  Ask whether crash-only makes it redundant before building it. → rule 1.
- **Crash** — the uncooperative off-switch: `kill -9`, the OOM killer,
  powerloss. Recovery *is* startup. → the rest of this file.

If you need asynchronous cancellation, the ordering is the whole contract:
request, wait for acknowledgment, *then* release. If you can't wait for an
ack because the peer may never respond, the ack itself needs a timeout — a
lease (rule 6), not an open-ended wait.

## 1. Stop = crash, start = recover

Give the component one idempotent off-switch (crash) and one idempotent
on-switch (recover) — nothing else. If the component is crash-safe, a second
"graceful" shutdown path is dead code: another way to mutate state, another
API, more bugs. Every extra stop mechanism is code that must itself be
correct, and it never runs in the one situation that matters.

## 2. Startup is recovery, and recovery runs every boot

Because there's no other way to start, the recovery code executes on every
single startup — so it is exercised constantly, unlike a rare exceptional
path. Make startup rebuild every invariant from durable state alone. If you
have a separate "fresh install" path that differs from the "recovery" path,
you now have two startups and one of them is never tested.

## 3. Crash from outside; don't trust the dying component to clean up

The crash mechanism lives outside the component — kill -9, the supervisor,
the VM, a panic that aborts without running destructors. Anything that "must
happen" during shutdown is a lie: rewrite it as something recovery
reconstructs instead. The component's own code may be exactly what is
broken; never let it participate in its own death.

## 4. Make retryable effects idempotent

Recovery and retry are only sound if re-running an operation is safe. Give
every effect an idempotency key or sequence number, or make it naturally
idempotent. Mark operations that aren't idempotent loudly, and compensate or
roll back instead of blindly retrying.

```
key = new_idempotency_key()
apply_payment(key, amount)   // safe to reissue after a crash
```

## 5. Carry the resume context; no hidden ambient state

A unit of work must be self-describing: everything a fresh instance needs to
resume it travels with the request or is re-resolvable from an ID. Hidden
in-process state dies with the crash and can't be rebuilt. (Same shape as
WRITE.md: pass identity, not references; load only the state you need.)

## 6. Timeout every interaction; lease every resource

No infinite waits, no permanent holds. Every call has a timeout; every lock,
claim, or allocation has a lease that expires. Expiry turns a hang into a
fail-stop — panic (or report to the supervisor) and recover, instead of
blocking forever.

```
let hold = acquire(resource, ttl = 30s)   // the hold dies on its own
```

## 7. Fail-stop by timeout

A timeout doesn't mean "retry in place and hope." It means "assume the peer
is dead": report it, and let the supervisor decide whether to crash-reboot
it. Turning every non-Byzantine failure into a crash collapses the fault
model to a single case — and components only need to know how to recover
from one kind of failure.

## 8. Keep durable state in a store; keep the component stateless

All important non-volatile state lives in a dedicated store whose recovery
is its own job. The component becomes a stateless client, so its own
recovery is trivial — nothing to reconstruct. The store itself must be
crash-safe *and* fast to recover (append-only log, frequent checkpoints),
or the problem has just moved down one level.

## 9. Use the weakest state guarantees that suffice

Don't reach for ACID transactions when a key-value store or a hashtable
satisfies the semantics. A simpler store has simpler, faster recovery. Match
the abstraction to the component's natural semantic level — not more
powerful than it needs, and not so weak that clients reimplement state
management on top.

## 10. Bound retries; back off; spread resubmission

A recovering peer is fragile: hammering it re-crashes it and the herd
thunders. Cap retries in policy, use exponential backoff, and jitter the
retry schedule so resubmissions spread out instead of landing at once.

## 11. Rejuvenate before failure

If crash-recovery is cheap, crash-reboot suspect components *before* they
fail — on resource-exhaustion symptoms, fail-stutter (slow, then slower), or
a workload trough. Bounded resource use plus watching for stall symptoms
(WRITE.md: bound everything) are your rejuvenation triggers.

## 12. Quiesce during recovery

While a component recovers, keep new work out and let in-flight work wait
and retry. Brief unavailability becomes raised latency, not errors. Don't
let a fresh flood of requests hit a component that is still rebuilding its
state.

---

Crash-only is the other half of the one rule: a panic is only usable as a
primary defense if it's cheap. This branch makes it cheap. WRITE.md builds
the contract, CRASHONLY makes it survive the crash, TEST.md proves the
recovery.
