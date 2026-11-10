# Performance

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Optimize against a measurement. Record a baseline with a repeatable command, change one thing, and re-measure the same way. Keep a change only if it beats run-to-run variance and every test stays green; revert the rest. Put the before and after numbers in the commit.
- Log every attempt, including reverted ones (idea, before → after, verdict), so a dead idea isn't tried again.
- At design time, before there's anything to profile, write a back-of-the-envelope sketch over network, storage, memory, and compute, each for bandwidth and latency. Name the bottleneck.
- Split the control plane from the data plane. Validate and assert once per batch, then run a branch-free loop over the data.
- Fetch related rows in the same query or one batched query, never one query per row (N+1). On a hot path, assert the query count in a test.
- Justify each index with the query plan before and after. Put equality columns first, then range or sort columns. An index that doesn't change the plan gets reverted.
- One connection pool per process, with `instances × pool max` under the database's connection limit and an acquire timeout. Behind autoscaling, put a pooling proxy in front instead of raising the max.
- A cache key includes every input that changes the result (tenant, viewer, locale, flags). Each cache states its staleness window and one invalidation strategy. Don't cache values whose staleness is a correctness bug (balances, permissions).
- Protect hot cache keys from a stampede: one request recomputes while the others wait or get the stale value.
- CPU-bound hot loops (only when a profiler names them): smaller types and packed structs, sequential access, struct-of-arrays, contiguous arrays over linked structures, static over dynamic dispatch, zero copy, cache-line-aligned fixed-size structs.
