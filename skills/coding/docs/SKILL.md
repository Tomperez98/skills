---
name: docs
description: >
  Write documentation and developer-marketing copy that meets a developer at
  their task. One rule: lead with the reader's task, win the 10-second skim,
  and never mislead. Covers READMEs and repo docs (a 10-second hero,
  what-it-is, install, one working example, benchmarks, link onward), API
  references and guides (signature, parameters, the error vocabulary, one
  example per operation, reference vs explanation), tutorials and quickstarts
  (one scoped outcome, copy-paste steps, expected output, checkpoints),
  changelogs and release notes (impact-first, breaking changes loudest, Keep
  a Changelog + SemVer), landing pages and positioning (value proposition,
  who it's for, why not the alternative, proof over adjectives, graphs and
  benchmarks, a runnable hero), and docs-as-marketing (docs that acquire and
  convert: findability, shareability, examples that sell, converting at the
  moment of success). Write so the skim — TL;DR, first image, headings,
  code, graphs — tells the whole story without the prose; be honest, think
  hard about why it matters, and never clickbait. Use whenever the user
  writes or fixes a README, API or reference docs, a tutorial or quickstart,
  a changelog or release notes, a blog post, or landing-page or positioning
  copy, or asks about docs-driven growth, developer marketing, making docs
  convert, or ranking in search — even if they never say "documentation" or
  "marketing".
---

# Docs & Developer Marketing

Write documentation and developer-marketing copy that meets a developer at
their task. Everything in this skill follows from one rule:

> **Lead with the reader's task — win the 10-second skim — and never mislead.**

Documentation and developer marketing are the same craft seen from two
angles: a developer arrives trying to *do something*, and your writing either
gets them to a working result (documentation) or convinces them your thing is
the way to that result (marketing). The best technical solution doesn't win —
the best-communicated one does. Both fail the same way: leading with
features, jargon, or a list of what *you* did, instead of what the reader can
do. Every branch in this skill is that rule applied to one artifact.

## Pick a branch

Identify which artifact you're writing — from the user's prompt, the
surrounding context, or by asking if the user is around:

- **"Write / fix the README"** → [README.md](README.md). Win the 10-second
  skim: hero, what-it-is, install, one working example, link onward.
- **"Write / fix API docs or guides"** → [API.md](API.md). Reference and
  concepts: signature, parameters, error vocabulary, one example per
  operation.
- **"Write / fix a tutorial or quickstart"** → [TUTORIAL.md](TUTORIAL.md).
  One scoped outcome, zero to working, copy-paste steps.
- **"Write / fix a changelog or release notes"** → [CHANGELOG.md](CHANGELOG.md).
  Impact first; breaking changes loudest; why an upgrade matters.
- **"Write / fix landing-page or positioning copy"** → [LANDING.md](LANDING.md).
  Value proposition, who it's for, why not the alternative, proof, runnable
  hero.
- **"Make docs acquire / convert / rank"** → [DOCS_MARKETING.md](DOCS_MARKETING.md).
  Docs-as-marketing: findability, shareability, and examples that sell.

Getting the branch wrong wastes the work — a changelog written like a landing
page hides the breaking change, and a landing page written like an API
reference loses the visitor. If it's genuinely ambiguous and the user isn't
reachable, default to the artifact named in the request, and state the
assumption at the top.

## The one rule

**Lead with the reader's task — win the 10-second skim — and never mislead.**

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

## Sources

- [Diátaxis — A systematic framework for technical documentation](https://diataxis.fr/)
- [The documentation system — Divio](https://documentation.divio.com/)
- [Google Technical Writing courses](https://developers.google.com/tech-writing)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/)
- [Obviously Awesome — April Dunford](https://www.aprildunford.com/books)
- [Heavybit — Developer marketing library](https://www.heavybit.com/library/)
- [SlashData — Developer marketing research](https://www.slashdata.co/)
- [GitLab — Developer marketing handbook](https://handbook.gitlab.com/handbook/marketing/developer-relations/)
