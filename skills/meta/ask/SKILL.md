---
name: ask
description: >
  Ask which skill and branch guide fit the situation. A router over the
  code, docs, ship, mvp, accordant, and writing-skills, and grill skills
  and the release, diagnose, and retro workflows. Invoked by name only.
disable-model-invocation: true
---

# Ask

You don't remember every skill and guide, so ask. Say what you're doing or
stuck on; this skill names the one skill and guide that pick it up, and
where the work goes after. Everything here follows from one rule:

> **Name one skill and one guide, and read it before you recommend it.**

## Route

1. **Say the situation back in one line**, in the user's words. If two
   situations fit and the answer changes the route, ask one question; if the
   user isn't around, pick by the file in front of you and say so.
2. **Find it on the map** (below) and read that skill's `SKILL.md`, then the
   guide its "Pick a branch" names.
3. **Answer in this shape**, and nothing longer:

   ```text
   Situation:  <one line, the user's words>
   Skill:      <skill> → <GUIDE.md>
   Why:        <the guide's own words for what it does, one line>
   Then:       <the next stop on the flow, or "done">
   ```

4. **Nothing fits** → say so and report it as a gap.

## The map

### The main flow: idea → users

Most work runs this path. Enter at the first stop that isn't done yet.

1. **No idea yet** → mvp: PICK; premise in doubt → RESEARCH; shape it →
   SPEC; too many features → AHA.
2. **Build it** → code: WRITE, with TEST alongside. A stateful API whose
   behavior should be checked against a model → accordant: SPEC, then
   GENERATE; once there is more than one cluster, SUITES; once green, COVERAGE.
3. **Put it in front of a person** → mvp: VALIDATE. A "no" goes back to AHA,
   not forward.
4. **Document it** → docs: README first, then API or TUTORIAL.
5. **Release it** → ship: CI before the first merge. Each release after
   that → the `release` workflow; a release process to set up or fix →
   ship: RELEASE and PUBLISH. The release notes are docs: CHANGELOG.

### On-ramps: work that arrives from outside

- **Something's broken, failing, flaky, or slow** → the `diagnose`
  workflow; a red accordant run is accordant: DEBUG; code that's hard to
  test or change is code: REFACTOR; a failed release is ship: RELEASE.
- **"Is this a breaking change?"** → ship: COMPAT. With an accordant spec,
  accordant: BASELINE runs the released spec against the new build.
  Several services shipping together → ship: ROLLOUT.
- **A spec change under review** → accordant: TRACES; routing review by
  contract change → ship: REVIEW.
- **A regression on main after merge** → ship: MONITOR.
- **A dependency to add, update, or audit** → code: DEPENDENCIES.

### Standalone

- **Writing, trimming, or changing a skill or an AGENTS.md** →
  writing-skills: NEW, EDIT, PRUNE. After a session that went sideways →
  the `retro` workflow.
- **A plan or decision to stress-test** → grill.
- **Too slow** → code: PERFORMANCE.
- **Config, env vars, globals, caches, or a schema** → code: STATE.
- **Designing an interface, naming, or splitting a function** → code: SHAPE.
- **Designing an HTTP API, choosing REST/GraphQL/RPC, pagination,
  versioning, or auth** → code: HTTP_API.
- **A tangled condition or multi-input decision** → code: LOGIC.
- **Crash safety, retries, timeouts** → code: CRASHONLY; against a remote
  system that may or may not have acted, accordant: FAULTS. Testing
  recovery, idempotency, or cancellation → code: CRASH_TESTS.
- **Races and background jobs** → accordant: CONCURRENCY and ASYNC.
- **Many suites / a slow suite / a nightly OOM / a doubled case count** →
  accordant: SUITES.
- **Traces or tests from a non-.NET system** → accordant: ORACLE.
- **Landing copy, or docs that should acquire users** → docs: LANDING,
  DOCS_MARKETING.

## Hand off

When the user says go, call the Skill tool with the skill the answer named
and follow its guide. A workflow (`release`, `diagnose`, `retro`) starts only
by name: tell the user to type it, such as `/release`.
