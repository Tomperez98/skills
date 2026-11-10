# Workflows and output patterns

Part of the writing-skills skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Break a complex task into numbered steps. For a long one, give a checklist the model copies into its response and ticks off (`- [ ] Step 1: Read all sources`). Each step then gets a short paragraph of what to do and what "done" means.
- Add a feedback loop to every quality-critical workflow: run the validator, fix the errors, repeat, and proceed only when it passes. The validator can be a script or a reference file to compare against (a style guide with a checklist). Say where to loop back to on failure ("If citations are incomplete, return to Step 3").
- For batch, destructive, or high-stakes changes, use plan-validate-execute: write the plan to a structured file (`changes.json`), validate it with a script, then apply it, then verify the result. Errors surface before anything changes, and the plan can be revised without touching originals.
- Branching tasks get a decision point first ("Creating new content? → Creation workflow. Editing? → Editing workflow"), then one short workflow per branch. When the branches grow long, move each into its own reference file and say which to read.
- Output templates: for strict formats (API responses, data files) say "ALWAYS use this exact structure" and give it. For flexible ones, give a sensible default and say to adapt sections to the case.
- When quality depends on style, show two or three input/output pairs, then name the pattern they share ("type(scope): summary, then detail"). Pairs convey style more reliably than a description.
