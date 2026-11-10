# Crash-only design

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

Name the stop mechanism first: synchronous cancellation (unwind), asynchronous cancellation (request, wait for ack, then release, with a lease on the ack), graceful shutdown, or crash.
- One stop path (crash) and one start path (recovery). If the component survives `kill -9`, a graceful shutdown path is dead code. Startup is recovery and runs on every boot. Don't write a separate fresh-install path.
- Nothing must happen at shutdown. Recovery rebuilds every invariant from durable state. Never read state a crash left half-written (poisoned locks, partially filled buffers).
- Make every retryable effect idempotent (idempotency key or sequence number). Mark non-idempotent ones loudly and compensate instead of retrying.
- A remote call has three outcomes: success, failure, and unknown (timeout, dropped connection). Record the intent durably before the call, so recovery can resolve an unknown by asking the peer or retrying with the same key.
- Assume at-least-once delivery from every queue and webhook. Consumers dedupe by message ID or idempotency key.
- A unit of work carries everything a fresh instance needs to resume it, or an ID that re-resolves it.
- Every call has a timeout and every lock, claim, or allocation has an expiring lease. A timeout means "assume the peer is dead": report it to the supervisor.
- Keep durable state in a crash-safe, fast-recovering store, and keep the component stateless. Use the weakest store semantics that suffice.
- Cap retries, use exponential backoff, and add jitter. Crash-reboot components on stall or exhaustion symptoms before they fail. Quiesce new work during recovery.
