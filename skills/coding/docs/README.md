# Writing a README (and repo docs)

The README is a landing page for a developer who typed one command too many
and just wants to know: *what is this, and is it worth my time?* You have
about ten seconds before they leave. Make the skim tell the whole story —
with something that runs. Apply the rules in order.

## 1. Lead with the hero — it's a 10-second skim

You have ten seconds, and the reader may never read a paragraph. The hero
must carry the whole pitch on its own: one line of what the reader can *do*,
plus one snippet, image, or benchmark that proves it. Not a logo wall, not a
feature list, not "X is a powerful, flexible, robust..." — the task, then the
proof.

```
# retry

Retry a failed operation with backoff.

    // (your language's idiomatic retry in ~6 lines)
```

If the name alone doesn't say what it does, the hero line says it. If a
snippet can show it, the snippet is the hero — a working example beats a
sentence.

## 2. Make the skim self-sufficient

An amazing README is one you can understand without reading any of the
prose: read only the TL;DR, the first image, the headings, and the code
blocks, and the story should still hold together. Structure for the skimmer —
every heading is a mini-claim, every code block a proof, the TL;DR a
one-line summary up top. If the page only makes sense when you read the
paragraphs, rewrite until it doesn't.

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

Give the exact command(s), no ceremony. One block, runnable as written.

```
# (package manager command)
```

## 5. One complete working example

The example must run as pasted — imports, setup, expected output. It is the
strongest thing on the page; don't truncate it with `...` in the interesting
part.

```
// complete, self-contained, with the output shown
```

A reader who pastes it and sees output is now evaluating you on merit, not
on prose. A reader who hits an import error closes the tab.

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

A build/coverage/version badge answers "is this alive and working?" — keep
those, at most a small row. Delete the rest; a wall of badges is noise that
pushes the example below the fold.

## 9. Cut the noise — and never mislead

Delete company history, "world's first", lists of adjectives, and every
claim you can't show. No clickbait, no "blazingly fast" unless the benchmark
backs it, no overselling — a developer who tries it on a false promise
leaves angry. If the project does something, the example shows it; if you
have to say it, you haven't shown it. Think hard about why it genuinely
matters, and say only that.

## 10. The top of the file is the whole pitch

Most readers never scroll. Assume they read the hero, the example, and the
install — and decide there. Put your three strongest beats in those first
lines, in that order: what it does, proof it works, how to get it.
