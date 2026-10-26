# Double booking

Two people sometimes get the same seat. accordant models the booking API,
then CONCURRENCY generates the collision the hand-written tests never hit.

**You:** Support says two customers sometimes end up with the same seat.
Our tests all pass.

**Agent** _(accordant: SPEC)_: "Sometimes both succeed" is a race, but
races are checked against a sequential spec, so I start with one.
(accordant skill, CONCURRENCY.md rule 1: sequential tests pass first.) The
cluster is the three operations that share seat state: `hold`, `confirm`,
and `release` (accordant skill, SPEC.md rule 1). The state holds only what the
contract needs: which seats are held or booked, and by whom.
(accordant skill, SPEC.md rule 3)

```csharp
// hold: one guard per refusal, in the contract's order
if (!state.Seats.ContainsKey(req.Seat))
    return Allow.Only(404, "unknown seat → 404");
if (state.Seats[req.Seat] is not Free)
    return Allow.Only(409, "seat already held or booked → 409");
return Allow.Only(200, "free seat → 200, held by caller")
    .ThenState(s => s.Hold(req.Seat, req.Caller));
```

**Agent** _(accordant: GENERATE)_: I bound the three calls to your HTTP
client, using two seats and two callers, so every input aims at a branch
(accordant skill, GENERATE.md rule 4). 212 sequences, all green. The
sequential contract holds.

**Agent** _(accordant: CONCURRENCY)_: Now the collision. I generated groups
where both callers `hold` the same seat at once (accordant skill,
CONCURRENCY.md rule 3), 500 groups:

```text
✗ group 137: no linearization
  A: hold(seat=1) → 200
  B: hold(seat=1) → 200
  No order of these two calls lets both return 200:
  "seat already held or booked → 409"
```

This is a bug report, not a flaky test (accordant skill, CONCURRENCY.md
rule 5). It failed in 3 of 500 groups.

**You:** Fix it.

**Agent** _(code: STATE)_: The handler reads the seat, checks it in app
code, then writes it. That's the race. The store should enforce the
invariant (code skill, STATE.md rule 5), so I added a conditional update,
`UPDATE seats SET holder = $1 WHERE id = $2 AND holder IS NULL`, and treat
0 rows as the 409.

Then:

- The 500 groups ran again: green.
- One green run is not proof (accordant skill, CONCURRENCY.md rule 7), so
  I ran 5,000 more: green.
- I pinned group 137 as its own case (accordant skill, CONCURRENCY.md
  rule 6), which fails on the old handler and passes on the new one.

**Agent:** To run it on every merge, the next stop is ship CI.md. Set that
up?
