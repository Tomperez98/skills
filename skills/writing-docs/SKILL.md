---
name: writing-docs
description: Applies rules for developer-facing writing - READMEs, API reference pages, guides, tutorials and quickstarts, changelogs and release notes, landing pages, and blog or launch posts. Use when writing, editing, or reviewing documentation, a docs example, a README, a changelog entry, release notes, product positioning, or marketing copy for a developer tool.
---

# Writing docs

Rules for READMEs, API references, tutorials, changelogs, landing pages, and docs as a growth channel. These rules are language-, framework-, and tool-agnostic. If another workflow skill is active, it owns the steps. Apply these rules inside each step. On conflict between a workflow skill's writing advice and these rules, these rules win. Say so when you override one.

**One rule: lead with the reader's task, win the 10-second skim, and never mislead.**
- Write the title, first sentence, and first example in the reader's task vocabulary ("retry a failed request"), not your feature list.
- Readers skim the TL;DR, the first image, the headings, and the code. If the page tells its story through those alone, it's done; if it needs the prose, it isn't. Something that runs proves more than a paragraph.
- No clickbait, no superlative you can't show, no overselling. Cut company history, adjective pile-ups ("powerful, flexible, robust"), and every sentence that doesn't serve the reader's task.
- When the artifact is ambiguous and the user isn't reachable, write the one the request names and state the assumption at the top.

## Examples (all artifacts)
- Every example runs as pasted: imports, setup, and the output shown. No `...` in the interesting part.
- Cut examples from a file CI runs, so they can't rot.
- Claim only what you ran. Without runnable source, build the example from a file you can execute, or mark it illustrative and name the parts the reader must fill in.
- Fence every snippet with its language.

## Load when the task matches
Read the whole file before writing that artifact:
- README → [reference/readme.md](reference/readme.md)
- API reference page, or a conceptual or migration guide → [reference/api-reference.md](reference/api-reference.md)
- Tutorial, quickstart, or getting-started page → [reference/tutorials.md](reference/tutorials.md)
- Changelog entry, changelog file, or release notes → [reference/changelogs.md](reference/changelogs.md)
- Landing page, homepage, positioning, or a comparison → [reference/landing-pages.md](reference/landing-pages.md)
- Blog post, launch post, or a page meant to rank in search → [reference/growth-content.md](reference/growth-content.md)

## Before finishing
Review the draft against this list. Fix each miss and re-check until the list is clean:
- [ ] The title, first sentence, and first example use the reader's task vocabulary.
- [ ] The headings, code, and first image tell the story without the prose.
- [ ] Every example runs as pasted, is fenced with its language, and was run, or is marked illustrative.
- [ ] Every claim of speed, size, or quality sits beside its evidence. No unshown superlative remains.
- [ ] Any assumption about an ambiguous artifact is stated at the top.
- [ ] Each reference file the task matched was read and applied.
