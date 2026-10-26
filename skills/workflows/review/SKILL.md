---
name: review
description: >
  Review a diff against its plan and the code guides, verify every finding,
  and report them most severe first. Invoked by name only.
disable-model-invocation: true
---

# Review

Find what is wrong with a change before it merges. Each step ends in a
`Done:` check; finish it before the next step starts. Everything here
follows from one rule:

> **Report only findings you tried to refute, most severe first.**

## 1. Fix the diff and its intent

Take the base the user names, or the merge base with main. List the
changed files, and read what the change is meant to do: the plan, the
pull request description, or the commit messages.

Done: the base SHA, the file list, and the intent in one line.

## 2. Review by dimension

Read each changed file whole, not only its hunks, against one dimension at
a time:

- **Intent:** the diff does what step 1 says, and nothing it doesn't.
- **Correctness and errors:** call the Skill tool with "code" and follow
  its WRITE.md; config, globals, or caches, its STATE.md.
- **Structure:** code SHAPE.md.
- **Tests:** code TEST.md. A new behavior with no test, or a test that
  can't fail (code skill, TEST.md rule 11), is a finding.
- **Contract:** a change to a public surface → call the Skill tool with
  "ship" and follow its COMPAT.md.

Up to a few hundred changed lines, review inline. Past that, send one
sub-agent per dimension in parallel, each given the base, the file list,
and the intent.

Done: candidate findings, each with a `file:line`, the guide rule it
breaks, and a concrete failure: these inputs or this state, this wrong
result.

## 3. Try to refute each finding

For each candidate, look for why it is wrong: read the callers and the
code around it, check whether a test already covers it, run a command that
would show the failure. Drop what doesn't hold. Mark the rest
**confirmed** (you saw it fail or traced it end to end) or **plausible**
(the reasoning holds, but you couldn't run it).

Done: every remaining finding is confirmed or plausible, with its evidence.

## 4. Report, most severe first

```text
<severity>  <file:line>  <the defect, one line>
            Rule:    <skill guide and rule number>
            Failure: <inputs or state → wrong result>
            Verdict: <confirmed | plausible>, <evidence>
```

An empty list is a valid result: say what you checked. Fix only the
findings the user picks.

Done: the user has the list and picked what to fix.

## Done when

- The intent was written down before the review started (step 1).
- Every dimension was read against its guide (step 2).
- Every reported finding cites a rule and a concrete failure, and survived
  an attempt to refute it (step 3).
- Nothing was fixed without the user picking it (step 4).

## Hand off

- **A picked finding needs a fix** → call the Skill tool with "code" and
  follow the guide the finding cites.
- **A finding breaks the contract** → call the Skill tool with "ship" and
  follow its COMPAT.md, then its REVIEW.md for the label.
- **A finding needs a reproduction to settle** → tell the user to type
  `/diagnose`.
