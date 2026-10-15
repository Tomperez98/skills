---
name: ask
description: >
  Ask which skill and branch guide fit the situation. A router over the
  code, docs, ship, mvp, and accordant skills. Invoked by name only.
disable-model-invocation: true
---

# Ask

You don't remember every skill and guide, so ask. Say what you're doing or
stuck on; this skill names the one skill and guide that pick it up, and
where the work goes after. Everything here follows from one rule:

> **Name one skill and one guide, and read it before you recommend it.**

The map below is for orientation only. A guide's summary drifts from the
guide; the guide doesn't. Never say what a guide does, or that a step can be
skipped, from this page alone.

## The one rule

**Name one skill and one guide, and read it before you recommend it.**

1. **Say the situation back in one line**, in the user's words. If two
   situations fit and the answer changes the route, ask one question; if the
   user isn't around, pick by the file in front of you and say so.
2. **Find it on the map** (below) and read that skill's `SKILL.md`, then the
   guide its "Pick a branch" names. Route by the guide, not by this page.
3. **Answer in this shape**, and nothing longer:

   ```text
   Situation:  <one line, the user's words>
   Skill:      <skill> → <GUIDE.md>
   Why:        <the guide's own words for what it does, one line>
   Then:       <the next stop on the flow, or "done">
   ```

4. **Nothing fits?** Say so. Don't stretch a skill over a situation it
   doesn't name; that's a gap worth reporting, not routing.

## The map

### The main flow: idea → users

Most work runs this path. Enter at the first stop that isn't done yet.

1. **No idea yet, or a vague one** → mvp: PICK, then RESEARCH if the premise
   is in doubt, SPEC to shape it, AHA to cut it to one use case.
2. **Build it** → code: WRITE, with TEST alongside. A stateful API whose
   behavior should be checked against a model → accordant: SPEC, then
   GENERATE.
3. **Put it in front of a person** → mvp: VALIDATE. A "no" goes back to AHA,
   not forward.
4. **Document it** → docs: README first, then API or TUTORIAL.
5. **Release it** → ship: CI before the first merge, then RELEASE and
   PUBLISH. The release notes are docs: CHANGELOG.

### On-ramps: work that arrives from outside

- **Something's broken** → a red accordant run is accordant: DEBUG; code
  that's hard to test or change is code: REFACTOR; a failed release is
  ship: RELEASE.
- **"Is this a breaking change?"** → ship: COMPAT. With an accordant spec,
  accordant: BASELINE runs the released spec against the new build.
- **A spec change under review** → accordant: TRACES.
- **A regression on main after merge** → ship: MONITOR.
- **A dependency to add, update, or audit** → code: DEPENDENCIES.

### Standalone

- **Too slow** → code: PERFORMANCE.
- **Crash safety, retries, timeouts** → code: CRASHONLY; against a remote
  system that may or may not have acted, accordant: FAULTS.
- **Races and background jobs** → accordant: CONCURRENCY and ASYNC.
- **Traces or tests from a non-.NET system** → accordant: ORACLE.
- **Landing copy, or docs that should acquire users** → docs: LANDING,
  DOCS_MARKETING.

## Hand off

The answer is the hand-off. When the user says go, load the skill rather
than carrying on from this map:

- **The route starts at an idea** → call the Skill tool with "mvp" and
  follow PICK.md.
- **The route starts at code** → call the Skill tool with "code" and follow
  the branch the answer named.
- **Any other route** → call the Skill tool with the skill the answer named
  and follow its guide.
