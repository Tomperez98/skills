# Tasks

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Slice vertically: each task delivers one user-visible path through every layer it needs (schema, logic, interface, test). Never "all the schema, then all the API".
- Each task has a title with one verb (an "and" means two tasks), at most three acceptance criteria, a verify command, its dependencies, and the files it will likely touch.
- Put the riskiest unknown first, so a dead end costs the least. Add a checkpoint every few tasks where the full suite runs and the plan is re-checked.
- Keep the list where the project tracks work (named in its rules file). Otherwise keep it in the response, or in a plan file the user agrees to. Never overwrite a plan file that still has unchecked tasks from other work: ask.
- Run tasks in parallel only when they share no files and the contract between them (types, schema, API) is written first.
- A task too big for one reviewable PR gets split again.
