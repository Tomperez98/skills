---
name: docs
description: >
  Write docs and developer-marketing copy that meets a developer at their
  task. One rule: lead with the reader's task, win the 10-second skim,
  never mislead. Use when the user writes or fixes a README, API docs, a
  tutorial or quickstart, a changelog or release notes, landing-page, blog,
  or positioning copy, or asks about docs-driven growth or search ranking —
  even if they never say "documentation" or "marketing".
---

# Docs & Developer Marketing

Write documentation and developer-marketing copy that meets a developer at
their task. Everything in this skill follows from one rule:

> **Lead with the reader's task — win the 10-second skim — and never mislead.**

## Pick a branch

Identify which artifact you're writing — from the user's prompt, the
surrounding context, or by asking if the user is around:

- **"Write / fix the README"** → [README.md](README.md).
- **"Write / fix API docs or guides"** → [API.md](API.md).
- **"Write / fix a tutorial or quickstart"** → [TUTORIAL.md](TUTORIAL.md).
- **"Write / fix a changelog or release notes"** →
  [CHANGELOG.md](CHANGELOG.md).
- **"Write / fix landing-page or positioning copy"** →
  [LANDING.md](LANDING.md).
- **"Make docs acquire / convert / rank"** →
  [DOCS_MARKETING.md](DOCS_MARKETING.md).

When the artifact is ambiguous and the user isn't reachable, default to the
one the request names and state the assumption at the top.

## What the rule requires

- **Their job, not your feature list.** A developer arrives with a task and a
  mental vocabulary for it ("retry a failed request", "migrate my schema",
  "ship an API"). Write the title, the first sentence, and the first example
  in *that* vocabulary. Features are the means; the reader's task is the
  end. Lead with the end.
- **Win the 10-second skim.** A reader gives you about ten seconds and may
  never read a paragraph — they read the TL;DR, the first image, the
  headings, and the code. So make the skim tell the whole story: a runnable
  example, a graph, a benchmark, a before/after. If the page makes sense
  read only through its headings, code blocks, and images, it's right; if it
  needs the prose, it isn't done. Something that runs proves more than a
  paragraph — it *is* the proof, and it's what gets shared.
- **Never mislead.** No clickbait, no "world's fastest" you can't show, no
  overselling. Think hard about why the thing genuinely matters to the
  reader, and say that — honestly. A claim you can't back up is noise; a
  claim you can back up is proof. Delete the company history, the adjective
  pile-ups, the "powerful, flexible, robust," and every sentence that
  doesn't serve the reader's task.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **Keeping a docs example runnable** → call the Skill tool with "ship" and
  follow CI.md: CI runs the file the example is cut from.
- **Release notes for a version about to ship** → call the Skill tool with
  "ship" and follow RELEASE.md for the version the entry belongs to.
