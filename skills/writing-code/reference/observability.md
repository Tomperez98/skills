# Observability

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply. Alerting and paging rules live in the shipping-changes skill.

- Before instrumenting, write the two to four questions on-call will ask ("which tenant's checkouts fail, and since when?"). Every signal answers one of them; cut signals that answer none.
- Accept a correlation ID at the edge, or generate one, and attach it to every log line, span, and outbound call, including queue message metadata. When several entry points (CLI, worker, cron) write to one log, stamp the entry point too.
- Log events, not prose: a stable event name (`payment.capture_failed`) plus structured fields. Write the fields for the person who must act, like an error message.
- `error` means someone must act: an invariant broke or a unit of work was abandoned. An expected failure the caller handles is `info` or `warn`.
- Allowlist the fields you log. Never log secrets, tokens, whole request or response bodies, or unmasked personal data.
- Metric labels come from small fixed sets: route template, method, status class, dependency name. Never IDs, raw URLs, user input, or error text.
- Record latency as a histogram and read percentiles (p50, p95, p99), never averages.
- Every endpoint and outbound dependency reports rate, errors, and duration. Every pool and queue reports utilization, saturation (depth or oldest-item age), and errors.
- Verify the telemetry before calling the work done: induce one failure and find it by its correlation ID in the logs and traces.
