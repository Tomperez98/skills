# Performance

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- At design time, before there's anything to profile, write a back-of-the-envelope sketch over network, storage, memory, and compute, each for bandwidth and latency. Name the bottleneck.
- Split the control plane from the data plane. Validate and assert once per batch, then run a branch-free loop over the data.
- CPU-bound hot loops (only when a profiler names them): smaller types and packed structs, sequential access, struct-of-arrays, contiguous arrays over linked structures, static over dynamic dispatch, zero copy, cache-line-aligned fixed-size structs.
