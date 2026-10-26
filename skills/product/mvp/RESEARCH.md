# Researching the premise

You have an idea and a premise about why it works — but you're not sure the
premise is real. The goal is a cited verdict on the premise and the next
stop. Apply the rules in order.

## 1. Research the premise, not the value

Ask research whether the trend is real, who's already shipping on it, and
where the gap is. Take "will people use this?" to a real person (see
[VALIDATE.md](VALIDATE.md)); researching the value is stalling, so go get a
verdict instead.

## 2. State the question before you run it

Hand deep research a specific question — "is X growing, and who's already
built on it?" — not a topic. A vague topic gets you a homework assignment; a
question gets you evidence you can act on.

When the harness can run a background agent, hand the research to one and
keep shaping the idea while it reads. Give it the question and the record
from rule 3 as its output, with a source on every line, under 300 words.
Tell it to write "no evidence found" rather than fill a line from memory.
Read the record it returns, not its transcript.

## 3. Keep the brief bounded

Extract the trend, the incumbents, and the gap, then stop reading. Keep the
research shorter than your idea's five-minute value window.

```text
Question:    <the question from rule 2>
Trend:       real | not real, <cited evidence>
Incumbents:  <who already ships on it>
Gap:         <what they do slowly or not at all>
```

## 4. Extract the gap, not the consensus

The useful finding isn't "it's popular" — it's "here's what existing
solutions do slowly or not at all." That gap is your five-minute opening; it
feeds [AHA.md](AHA.md).

## 5. Route on the verdict

- **Premise confirmed** → [SPEC.md](SPEC.md), borrowing the incumbents'
  interface patterns and pain points.
- **Premise false** → back to [PICK.md](PICK.md) for another idea.

## Done when

- The question was written down before the research ran (rule 2).
- The brief is reduced to its record: trend, incumbents, and gap (rule 3).
- The gap names what incumbents do slowly or not at all, not that the space
  is popular (rule 4).
- Every question asks about the trend, incumbents, or gap, and the next step
  is SPEC on a confirmed premise or PICK on a false one (rules 1, 5).
