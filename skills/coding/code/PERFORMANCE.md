# Making it faster

Something is slow, or you're designing a system where speed is a
requirement, not an afterthought. Correctness comes first — WRITE.md builds
the contract — but a correct answer that arrives too late is still a
failure. Apply the rules in order.

## 1. Sketch performance before you build

The 1000x wins are only available at design time, when you can't profile.
Do a back-of-the-envelope sketch over the four primary colors — network,
storage, memory, compute — each with two textures: bandwidth and latency.
Roughly right beats precisely wrong, and the sketch tells you which rule in
this file actually matters for this system.

Do this before you touch rule 2 or 3: a sketch tells you whether the
bottleneck is indirection, batching, both, or neither — chasing the wrong
one wastes the work.

## 2. Keep the hot path free of indirection

When something runs many times — a loop, a request path, a query — the
dominant cost is usually chasing something indirect. Identify the access
pattern and remove indirection from it.

- **One batched query, not one per item.** An N+1 loop is a dereference per
  row: a round-trip for each item instead of one fetch.
- **Set-based over row-by-row.** Filter, join, and aggregate in the store,
  not by fetching rows and branching in a loop.
- **Do checks once, outside the loop.** Split a mixed collection by kind
  before iterating, instead of branching per element.
- **Measure, don't assume.** These are constant-factor wins with identical
  big-O. Profile first; a cold path may show no difference.

*CPU-bound translation: "indirection" becomes cache misses and blocked
vectorization. The unit is the cache line — the smallest chunk moved between
RAM and the CPU — so the goal is more useful data per line, read in order:*

- *minimize footprint* — smaller types, structure packing (reorder fields,
  drop padding), so one line holds more items;
- *access sequentially* — iterate in memory order so a fetched line is fully
  used;
- *struct-of-arrays* — keep the fields a hot loop touches contiguous;
- *contiguous arrays over linked structures, static over dynamic dispatch* —
  less pointer chasing, so the compiler can vectorize;
- *zero copy in the data plane* — don't copy memory, don't serialize or
  deserialize; operate on data in place;
- *fixed-size, cache-line-aligned structs* — align a struct to its largest
  field so it never straddles two cache lines.

*Reach for these only when a profiler names the loop.*

## 3. Split the control plane from the data plane

Batch work so decisions run once per batch, and let the hot loop sprint
through data without branching. Checks, assertions, and validation live in
the control plane — amortized across the batch — while the data plane stays
a tight loop the CPU can vectorize.

```
// Control plane: one check, one decision
if !batch_is_valid(batch): return Err(InvalidBatch)

// Data plane: a branch-free sprint over the batch
for item in batch { process(item) }
```

An assertion costs almost nothing once per batch; the same assert per item
would dominate the data plane. This is where fail-fast and performance
agree: the control plane can afford to be paranoid — WRITE.md's assertions
(rule 1) belong in the control plane, not repeated inside the hot loop.

---

These are constant-factor wins, not new algorithms — pick the right
algorithm first, then apply these to the one the profiler names. When the
component also needs to survive a crash mid-batch, CRASHONLY.md covers
making that recovery cheap.
