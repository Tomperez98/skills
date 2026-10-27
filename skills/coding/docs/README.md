# Writing a README (and repo docs)

The README is a landing page for a developer who typed one command too many
and just wants to know: *what is this, and is it worth my time?* Apply the
rules in order.

## 1. Lead with the hero, then what it is, then install

The first lines give what it does, proof it works, and how to get it, in
that order: the hero, then rules 3 and 4. The hero carries the whole pitch
on its own: one line of what the reader can *do*, plus one snippet, image,
or benchmark that proves it.

```
# retry

Retry a failed operation with backoff.

    // (your language's idiomatic retry in ~6 lines)
```

If the name alone doesn't say what it does, the hero line says it. If a
snippet can show it, the snippet is the hero — a working example beats a
sentence.

## 2. Make the skim self-sufficient

Apply "win the 10-second skim" from [SKILL.md](SKILL.md) to the whole file:
headings as mini-claims, code blocks as proofs, a one-line TL;DR up top.

## 3. Say what it is, in one concrete sentence

One or two sentences, concrete nouns, the reader's vocabulary. Name the
problem and the thing, not the adjectives.

```
What it is:
retry wraps a function so that a failed call is retried with exponential
backoff and jitter. It returns the same error type your function does, so
callers don't change.
```

## 4. Install, copy-paste

Give the exact command(s) in one block, runnable as written.

```
# (package manager command)
```

## 5. One complete working example

The example must run as pasted — imports, setup, expected output. It is the
strongest thing on the page, so keep the interesting part complete, with no
`...`. To keep it that way, cut it from a file CI runs (ship skill, CI.md):
load the "ship" skill and follow its CI.md to wire that up.

```
// complete, self-contained, with the output shown
```

**Claim only what you ran.** The example is the page's proof. When you don't
have the source, either build the example from a file you can execute, or
make it explicitly illustrative and mark the parts a reader must fill in.

## 6. Show numbers, not just words

A graph, a benchmark table, or a before/after timing is worth more than any
paragraph about performance — and it survives the skim. If your thing is
faster, cheaper, or smaller, show the chart and let the reader read the
numbers. Just as a runnable example is the proof of "works", a benchmark is
the proof of "fast".

## 7. Link onward; don't cram

The README is the front door, not the whole house. For anything that needs
more than a paragraph — configuration, advanced usage, contributing, the
full API — link to the doc that owns it. A README that's 40% caveats buries
the "should I care" answer.

## 8. Badges only when they answer a question

Keep the build/coverage/version badges that answer "is this alive and
working?", as one small row, so the example stays above the fold.

## 9. Cut the noise — and never mislead

Apply the never-mislead rule in [SKILL.md](SKILL.md). For a README:
"blazingly fast" appears only beside its benchmark, and company history and
"world's first" go. If the project does something, the example shows it.

## Done when

- The top of the file, read alone, gives what it does, proof it works, and
  how to get it, in that order (rule 1).
- Reading only the TL;DR, headings, and code blocks still tells the story
  (rule 2).
- The install command and the example run as pasted and print the output
  shown — or the example is marked illustrative, with the parts to fill in
  named (rules 4–5).
- Every speed, size, or superlative claim has a number on the page behind it;
  the rest is cut (rules 6, 9).
- Configuration, advanced usage, and the full API are links, and badges are
  one row of the "is it alive" kind (rules 7-8).
