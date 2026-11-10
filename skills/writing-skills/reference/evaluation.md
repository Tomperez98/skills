# Evaluation and iteration

Part of the writing-skills skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Build evaluations before writing much of the skill. Run representative tasks without the skill, record what goes wrong, and write at least three scenarios that target those gaps. Then write just enough to close them, and compare against the baseline.
- Write each scenario as data: the skills, the query, the input files, and a list of expected behaviors, each one checkable from the output (`"Saves the text to output.txt"`, not `"does a good job"`). There's no built-in runner, so keep the format simple enough to script.
- Include behaviors that test navigation, not just the result: which reference file should have been read for this task.
- Run each scenario in two arms, without and with the skill, in separate scratch copies of the inputs. Grade blind: hide which arm had the skill, and use a grader that didn't produce either output.
- Test with every model the skill will run on. A smaller model may need more guidance; a larger one may suffer from over-explanation. Aim for wording that works on all of them.
- Iterate with two instances: one helps write and refine the skill, a fresh one with the skill loaded does real tasks. Bring the fresh instance's specific failures back ("it skipped the test-account filter on a regional report") and revise, then test again.
- Watch how the skill is navigated. An unexpected reading order means the structure isn't intuitive. A file that's never opened is unnecessary or badly signposted. A file read on almost every task belongs in `SKILL.md`. A missed rule needs more prominence, such as moving it up, into the checklist, or into stronger wording ("MUST").
- Test triggering separately from content: give requests that should and shouldn't select the skill, and check the description picks it out.
- When converting an existing document into a skill, check mechanically that every rule line survived, and change wording only where you meant to.
