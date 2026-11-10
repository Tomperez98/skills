# Bundled scripts

Part of the writing-skills skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Prefer a bundled script for anything deterministic or fragile (validation, extraction, format conversion). It's more reliable than generated code, its source costs no context when run, only its output does, and every run behaves the same.
- Say whether to run a script or read it: "Run `scripts/analyze_form.py` to extract fields" versus "See `scripts/analyze_form.py` for the extraction algorithm". Running is the default.
- Document each script where it's referenced: the exact command, its arguments, and the output format (`# prints "OK" or lists each conflict`).
- Solve, don't defer: a script handles its expected failures (missing file, permission denied) and reports what to do, instead of crashing and leaving the model to guess.
- Justify every constant in a comment (`# 30s: requests normally finish well within this`). A value you can't explain is one the model can't choose either.
- Make validator errors specific and actionable: name the bad value and list the valid ones ("Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed").
- List every package a script needs, with its install command, and confirm the target runtime can install or already has it.
- Use forward slashes and paths relative to the skill directory.
