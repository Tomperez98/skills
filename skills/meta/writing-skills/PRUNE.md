# Trimming a skill

You're trimming, auditing, or reviewing a skill or an agent instruction
file because it is long, slow to load, or ignored. The goal is the same
behavior from fewer lines. Apply the rules in order, and make each cut one
at a time so you can see which one changed the behavior.

## 1. Measure first

List every file the agent loads for the situation, with its size. Separate the
always-loaded files (skill descriptions, the project instruction file) from the
files behind a pointer. Trim the always-loaded ones first: each of their lines
costs every task.

```bash
find <skills-dir> -name SKILL.md -exec wc -c {} +
wc -c <instruction file>
```

## 2. Find the duplicates

Search for each rule's wording elsewhere in the repo: the one rule restated
in the intro, again in a blockquote, again in a section of its own; a
guide's summary beside its pointer; an index row that restates a guide.
Keep the copy in the guide that owns it. Replace each other copy with a
pointer or delete it.

## 3. Find the no-ops

Delete a line when the agent already does it by default or can find it by
looking:

- "Read the repo's conventions before you write."
- A command's flags, a config value, a path a script already encodes.
- A caution against something the model doesn't do unprompted.

Keep a fact only when looking can't recover it: a decision, a reason, a
convention nothing in the repo enforces.

## 4. Turn prohibitions into instructions

A "never X" names X, and the name makes X more likely. State what to do
instead.

- "Don't re-validate in every function" → "Validate once at the edge; inner
  functions trust the parsed type."
- "Never drop a returned error" → "Handle, propagate, or visibly discard
  every returned error."

Keep a prohibition for an irreversible step, where the cost of the mistake
justifies naming it, and pair it with where the agent stops and asks.

## 5. Replace repeated phrases with a leading word

When a phrase recurs, pick a compact word the model already knows and use it
everywhere ("crash-only", "idempotent", "linearizable", "SemVer"). An
existing word carries its meaning for free. Define an invented word once,
where it first appears, and use it consistently after.

## 6. Split what only some situations need

Group a long guide's rules by the situation that triggers each. Move a group
that fires in one situation behind a pointer with that trigger (NEW.md
rule 4). Keep in the always-read file only what every use needs. Give each
new guide its own `## Done when`.

## 7. Sharpen the ends

For each step, ask how the agent knows it is finished. Replace a vague end
("make sure the tests are good") with a checkable one ("every returned
failure has a test"). Make the criterion exhaustive where the work is a
sweep.

## 8. Re-run the situation that exposed the problem

Run the original prompt against the trimmed skill. The behavior must be the
same or better, and the checks the repo defines must pass. A cut that
changed the behavior goes back, rewritten rather than restored verbatim.

## Done when

- The always-loaded lines are the ones that change behavior, with their
  sizes before and after on record (rules 1 and 3).
- Each meaning appears once, and each other mention is a pointer (rule 2).
- Prohibitions read as instructions, except at an irreversible step
  (rule 4).
- Every guide serves one situation and ends in checkable items (rules 6
  and 7).
- The original prompt behaves as before or better, and the repo's checks
  pass (rule 8).
