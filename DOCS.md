# DOCS.md

Rules for READMEs, API references, tutorials, changelogs, landing pages, and docs as a growth channel. These rules are language-, framework-, and tool-agnostic. If a skill or process framework is available, it owns the workflow. Apply these rules inside each step. On conflict, these rules win. Say so when you override one.

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

## README
- Order the top of the file: the hero (one line of what the reader can *do*, plus a snippet, image, or benchmark that proves it), then what it is, then install. If a snippet can show it, the snippet is the hero.
- Use a one-line TL;DR, headings that state mini-claims, and code blocks as proofs.
- Say what it is in one or two concrete sentences, naming the problem and the thing, not adjectives.
- Give install commands in one block, runnable as written.
- Show numbers for speed, size, or cost claims (a chart, a benchmark table, before/after timing). "Fast" appears only beside its benchmark.
- Link out for anything longer than a paragraph: configuration, advanced usage, contributing, the full API.
- Keep only badges that answer "is this alive and working?", in one row, so the example stays above the fold.

## API reference and guides
- One page per operation, with a stable URL, titled with the task people search ("List org members", "Migrate from v1"), not the internal function name.
- Order each page: the signature as called, each parameter with type and meaning, the return, then one complete example. Each line says what the signature can't (what happens to an absent item), not "remove_item removes an item".
- Name the fault model: every error, with what the caller should do, and every panic, as a precondition the caller must know.
- Keep reference (signature, errors) and explanation (why it works that way) in separate sections or pages.
- Guides own the mental model: the system's nouns, their relationships, and invariants. Name the model, then map the API onto it.
- Put the happy path first, in its simplest form. Edge cases, limits, and caveats come after, clearly marked.

## Tutorial or quickstart
- One outcome, stated in the first line ("Deploy a todo API to Fly in 10 minutes"), plus prerequisites with how to check each. Or start from a cloneable zero-setup state.
- Every step is copy-paste and produces something visible. Show what success looks like, and name the one or two failures a real reader hits and how to recover ("If you see EADDRINUSE, port 3000 is taken").
- Build one working slice at a time, and link the complete code at each checkpoint so a reader can catch up.
- Stay on the line: every step serves the one outcome. Tangents go on another page.
- End with the finished result and one concrete next step: a reference link, a challenge, or a guide.
- Run it from scratch in a clean environment, pasting each command as written. Any mismatch is a bug in the tutorial.

## Changelog and release notes
- One section per release in SemVer, newest first, dated, linked to its compare/diff, grouped Added / Changed / Deprecated / Removed / Fixed / Security.
- Breaking changes go first, each with a migration note: what to change, and what happens if you don't (`retry(3, 100)` becomes `retry({ max_attempts: 3, base: 100 })`).
- Each entry states the impact for the user, not the diff. One entry, one change: a bullet that needs "and" twice is two bullets.
- Skip internal refactors, dependency bumps users can't see, and typo fixes. A dependency update that fixes a security issue or changes behavior is an entry.
- Write each entry in the same commit as its change, as its own fragment file (e.g. `.changes/`), never into one shared "Unreleased" block. Assemble fragments at release time.
- Release notes are the pitch, not the record. Lead with the headline change and the problem it solves, with a before/after example.

## Landing page and positioning
- Write positioning before copy: the competitive alternative (what the reader would do without you), your differentiated value, and who cares most. If you can't state these, the page will waffle.
- Hero: one task headline, one subhead with the differentiated value, one snippet that shows it working, then a single call to action. The snippet is the claim.
- One primary CTA (try it), repeated. Secondary links go in the footer.
- A short, fair comparison that names the real alternatives ("your own retry loop", "library X") and the one thing you do that they don't.
- Replace every adjective with evidence: a number, a name, a benchmark, a chart, or a runnable snippet. Two real datapoints beat ten superlatives. If a claim can't be shown, cut it.
- Open with the reader's problem. Mission, "we believe", and the founding story go at the bottom, if at all.
- A page sells one job to one reader. The homepage sells the main job and links to pages for the others.

## Docs as a growth channel (blog, launch post, search)
- One page, one search intent: the title is the query a developer types, and the first scroll delivers it.
- Every page stands alone from its link (context, example, and result on the page), so it reads like something a colleague would share.
- The example is the ad: a real task, short enough to fit one screen.
- Convert at the moment of success: right after the example works, give the next step in the reader's task (install, use it in your stack, next page), not a banner.
- Target the long-tail "how do I do X with Y" queries where your product genuinely wins.
- Measure reads, copied examples, and pages that precede a signup, not vanity pageviews. Read-but-not-converting pages mean the example isn't carrying its weight.
- Write the example once and reuse it across surfaces with each surface's framing: the README leads with the hero, the launch post with the story, the docs page with the task.
