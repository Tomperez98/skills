# Idea to release

From "is this worth building?" to a published package, using every stage of
the main flow.

**Idea:** a CLI that tells you which pull requests are waiting on your
review.

## Shape it

**You:** I want a small tool that tells me which PRs are waiting on me. Not
sure it's worth building.

**Agent** _(mvp: RESEARCH, then SPEC)_: I checked first: `gh pr list
--search "review-requested:@me"` gets halfway there, but it doesn't rank by
age or cover more than one repo. So the premise holds: the gap is "across
repos, oldest first". Here's the spec:

```text
You run `waiting` in any terminal; it lists every PR across your repos
where your review is requested, oldest first, with how long it's waited.

- Screen:   a table: age · repo · title · author
- Action:   run `waiting`, optionally `--org replit`
- Output:   the list, or "Nothing waiting on you"
- Key use:  start of day, know what to unblock first
```

A few decisions here are yours, so I'm handing them to grill.

## Settle the decisions

**Agent** _(grill)_: I looked up what I could: `gh` is installed and logged
in, and the search API supports `review-requested`. Round 1:

```text
Q1 · Data source: shell out to `gh`, or call the GitHub API directly?
→ Shell out to `gh`: auth is already solved.

Q2 · Scope: all repos you can see, or one org?
→ All, with `--org` to narrow.

Q3 · Language: Go single binary, or a Node script?
→ Go: one binary, no runtime.
```

**You:** yes, yes, but Node, I want to npx it.

**Agent:** Round 2 (it depends on Q3):

```text
Q4 · Distribution: npm package, run via npx?
→ Yes. `waiting` is taken on npm (I checked), so `@tomperez98/waiting`.
```

**You:** yes

**Agent:** Summary: Node, shells out to `gh`, all repos with `--org`,
published as `@tomperez98/waiting`. Confirm?

**You:** confirmed

**Agent:** Plan settled. Type `/implement` to build it.

## Build it

**You:** `/implement`

**Agent** _(implement)_:

**1. Settle the plan.** Done: the plan above, no open decision.

**2. Cut vertical slices.**

1. `waiting` prints the PRs from one `gh` call, unsorted. _Test: fake `gh`
   output → three rows printed._
2. Sort oldest first and show the age. _Test: rows come out by age, "3d"
   format._
3. `--org` narrows the search. _Test: the `gh` call includes
   `org:replit`._
4. Empty state and `gh`-missing error. _Test: "Nothing waiting on you"; a
   missing `gh` exits 1 with an install hint._

Done: four slices, each with its test. Carrying on unless you object.

**3. Red (slice 1).** Wrote `waiting.test.js`, feeding in a fake `gh`
runner.

```text
✗ prints one row per PR
  TypeError: listWaiting is not a function
```

That's a missing-module error, not the missing behavior, so I added an
empty `listWaiting`. It runs again:

```text
✗ prints one row per PR — expected 3 rows, got 0
```

Done: red for the right reason.

**4. Green.** I implemented `listWaiting(run)`, which parses `gh`'s JSON. A
malformed payload is a bug and panics; `gh` missing is an expected failure
and returns an error value (code skill, WRITE.md rule 2). Done: 1/1
passing, suite green.

**5. Clean up.** Pulled the `gh` call behind a `run` parameter, the one
seam the tests need (code skill, SHAPE.md rule 2). Done: suite green.

**6. Commit.** `feat(cli): list PRs awaiting review`. Back to step 3 for
slice 2…

Slices 2–4 follow the same loop.

Done: four commits, suite green. Type `/review`.

## Review it

**You:** `/review`

**Agent** _(review)_:

**1.** Base `a1c9e02` (merge base with main), 4 files, +212 lines. Intent:
"list PRs awaiting my review across repos, oldest first, with `--org`."

**2.** Under a few hundred lines, so I reviewed inline: intent, errors,
structure, tests, contract.

**3.** I tried to refute each candidate and dropped two. One was a "missing
timeout on `gh`", but `gh` already times out by default. Kept:

```text
high    src/age.js:14  Age uses local midnight; a PR opened 23h ago
                       shows "0d" and sorts after one opened yesterday
        Rule:    code skill, TEST.md rule 10 (test the contract as properties)
        Failure: createdAt 23h ago vs 25h ago → order flips at midnight
        Verdict: confirmed, failing property test attached

low     src/cli.js:31  `--org` with no value searches `org:undefined`
        Rule:    code skill, WRITE.md rule 3 (parse at the edge)
        Failure: `waiting --org` → empty list, no error
        Verdict: confirmed, ran it
```

Which should I fix?

**You:** both

**Agent:** Fixed, one commit each, each with a test I watched fail first.
Suite green.

## Put it in front of a person

**You:** I tried it on two teammates. Both said "can it show which ones I
already commented on?"

**Agent** _(mvp: VALIDATE)_: That's a second feature. Both of them got the
aha (what to unblock first) inside a minute, so the MVP holds. I'd log the
request and ship as is. Your call: ship, or slice it in now?

**You:** ship. Write the README first.

**Agent** _(docs: README)_: The README leads with the task: install, run,
and what you'll see. Then flags, then the `gh` requirement. Done.

## Ship it

**You:** set up CI, then `/release`

**Agent** _(ship: CI)_: Added one workflow that runs `npm test` and lint on
every PR and push to main. Done.

**Agent** _(release)_:

1. **Version:** first release, so `0.1.0`. No released contract to diff
   against.
2. **Changelog:** a `0.1.0` entry, built from the six merged commits.
3. **Freeze:** remote main is `f83b2d1`, and CI is green for that SHA.
4. **Stop and ask:**

   ```text
   SHA:      f83b2d1
   Version:  @tomperez98/waiting@0.1.0
   Entry:    Initial release: list PRs awaiting your review…
   ```

   Go?

**You:** go

**Agent:**

5. **Published.** A clean `npx @tomperez98/waiting@0.1.0` in a temporary
   directory printed the table, and `latest` → `0.1.0`. Done.

## Look back

**You:** `/retro`

**Agent** _(retro)_: One moment worth fixing:

```text
low   Slice 1's first red was a missing-module error, not the behavior
      Layer:  rule
      Change: implement step 3: "stub the export first so the first red
              is the behavior", in skills/workflows/implement/SKILL.md
```

Apply it?

**You:** yes

**Agent:** Applied: `/implement` step 3 now says to stub the function or
module first, so the first red is the behavior.
