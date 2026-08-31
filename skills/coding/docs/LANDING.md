# Writing landing pages and positioning

A landing page has seconds to answer three questions for a developer: *what
job does this do for me, why is it better than what I'd otherwise do, and is
the proof real?* Answer them in that order, with something that runs. Apply
the rules in order.

## 1. Position before you write

Positioning comes first: name the competitive alternative (what the reader
would do without you), your differentiated value (what you do that the
alternative can't), and who cares most. If you can't say these, the page
will waffle no matter how well you write it.

```
Alternative:    hand-rolled retry loops, or retrying with no backoff
Differentiated: correct backoff + jitter out of the box, one function
Who cares most: backend devs shipping anything that calls a flaky API
```

## 2. The hero leads with the job, then the proof

One headline in the reader's task vocabulary, one subhead with the
differentiated value, and one code snippet that shows it working — then a
single call to action. No "powerful, flexible, scalable." The snippet *is*
the claim.

```
# Retry flaky calls, correctly.

Stop writing backoff by hand. retry adds exponential backoff with jitter in
one function — and returns your error type unchanged.

    $ npm install retry
    // one complete example

[Get started]  [Read the docs]
```

## 3. One call to action

The visitor does exactly one thing: try it. Every other link ("learn more",
"see pricing", "read the blog") competes with that. One primary CTA,
repeated; secondary links go in the footer.

## 4. Answer "why not the alternative"

A short comparison that names the real alternatives ("your own retry loop",
"library X") and states the one thing you do that they don't — without
slandering them. Developers are allergic to vague "better, faster, more
robust"; they respect a concrete "X does A, we do A and B."

## 5. Proof over adjectives

Replace every adjective with evidence: a number ("recovers 99.9% of
requests"), a name ("used by ..."), a benchmark, a graph, or a snippet. A
chart showing you ahead of the alternative beats any adjective; a snippet
the reader can run beats any chart. If the claim can't be shown, cut it. Two
real datapoints beat ten superlatives.

## 6. Cut the self-talk

Delete "our mission", "we believe", the founding story, and the company
timeline from the top of the page. The reader didn't come to learn about
you; they came to learn whether you solve their problem. Put that stuff at
the bottom, if at all.

## 7. The page is one job, not the whole product

A landing page sells one job to one reader. If your product does five
things, the homepage sells the main one and links to pages that sell the
others. A homepage that lists everything sells nothing.

## 8. Never mislead

No clickbait, no "world's fastest" you can't prove, no overselling. A
developer who tries your thing on a false claim leaves angry and tells
everyone. Think hard about why it genuinely matters to the reader, and say
only that. Honesty compounds; hype burns out.
