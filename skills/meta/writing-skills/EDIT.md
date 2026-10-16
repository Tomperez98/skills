# Changing a skill

You're changing what an existing skill makes the agent do. The goal is a
change that lands in one place, keeps the one rule intact, and leaves every
pointer and citation true. Apply the rules in order.

## 1. Reproduce the behavior you want to change

Run the skill on the prompt that went wrong, and note the exact line the
agent followed or skipped. The cause is one of four:

- The skill never fired → the description (NEW.md rule 3).
- The agent read the wrong guide → the pointer (NEW.md rule 5).
- The agent read the right guide and stopped early → the completion
  criterion (NEW.md rule 6).
- The agent followed the guide and the guide was wrong → the rule itself.

Fix the one that matches. A change in the wrong layer leaves the behavior
as it was.

## 2. Edit the source of truth

Each meaning lives in one place. Find it before you edit:

```bash
grep -rn "<the phrase>" skills/ README.md AGENTS.md
```

Edit the branch guide that owns the rule. Delete the copies that summarise
it elsewhere (`SKILL.md`, README rows, a router) or reduce each to a
pointer, so the next change touches one file.

## 3. Keep the one rule intact

The change turns the rule into better procedure. When the change contradicts
the rule, the rule is wrong or the change belongs in a different skill; say
which, and decide before you write.

## 4. Move and renumber without breaking citations

Inserting, removing, or moving a numbered rule shifts every citation that
points at a later rule. Before the edit, list the citations:

```bash
grep -rnE "<GUIDE>\.md[^.]*rules? [0-9]" skills/ README.md
```

After the edit, update each one. Where the repo has a link checker, run it:
it names every citation that now points at a different rule.

## 5. Re-read the neighbours

Read the guides that cite or hand off to the edited one, and the router's
entry. Update any summary that no longer matches. Check that the edited
guide's `## Done when` still cites rules that exist.

## 6. Say what kind of change it is

Name the effect on people who install and cite the skill: unchanged,
additive (a new guide or rule), changed (a rule's meaning), or breaking (a
removed or renamed skill, guide, or rule). Put it in the commit or pull
request.

## Done when

- The change traces to one cause in one layer (rule 1).
- Each meaning still lives in one file, with no stale copy left (rule 2).
- The one rule is unchanged, or the change says why it moved (rule 3).
- Every citation and pointer resolves to the rule it meant, and the repo's
  checks pass (rule 4).
- The neighbours and the router agree with the edit, and the change is
  labeled (rules 5 and 6).
