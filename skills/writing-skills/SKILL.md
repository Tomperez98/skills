---
name: writing-skills
description: Applies authoring rules for Agent Skills - SKILL.md frontmatter, names, descriptions, progressive disclosure, reference files, workflows, bundled scripts, and evaluations. Use when creating, editing, splitting, reviewing, or testing a skill, turning a guide or prompt into a skill, writing a project rules file such as AGENTS.md or CLAUDE.md, or when a skill triggers at the wrong time or its instructions are ignored.
---

# Writing skills

These rules cover how a skill is written, not what it teaches. The skill's own domain rules decide its content. If another workflow skill is active, it owns the steps. Apply these rules inside each step. Say so when you override one.

**One rule: every token earns its place, and evals decide what stays.** Only the name and description sit in context all the time; the body loads when the skill triggers, and other files load only when read. The model is already capable, so add only what it lacks: rules it gets wrong without the skill, project facts, and fragile procedures. Find those gaps by running real tasks without the skill first, and cut whatever the baseline already does.

## Frontmatter
- `name`: at most 64 characters, lowercase letters, digits, and hyphens only, no XML tags, and never the reserved words `anthropic` or `claude`.
- Name the activity, preferably as a gerund (`writing-docs`, `processing-pdfs`). Noun phrases (`pdf-processing`) are acceptable. Use one pattern across a collection. Avoid vague or generic names (`helper`, `utils`, `files`).
- `description`: non-empty, at most 1,024 characters, no XML tags. It's the only text used to pick the skill out of many, so it states what the skill does and when to use it.
- Write the description in third person ("Extracts text from PDFs"), never "I can" or "You can". It's injected into the system prompt.
- Put the trigger words in it: the file types, tools, artifacts, and phrasings a user actually says ("Use when working with PDF files, forms, or document extraction"). "Helps with documents" never triggers reliably.

## Structure
- `SKILL.md` is the overview and table of contents. Keep its body under 500 lines, and split before you reach that.
- Keep rules that apply to almost every use of the skill in `SKILL.md`. Move area-specific material into files named for their content (`reference/finance.md`, not `doc2.md`), organized by domain or task, so one task loads one file.
- Link every file directly from `SKILL.md`, one level deep. A file reached only through another file may be read partially (`head -100`) or missed.
- Make each link a trigger: say which task reads which file ("Writing tests → read `reference/tests.md`"). A bare "see also" list gets skipped.
- Give any reference file over 100 lines a table of contents at the top, so a partial read still shows its scope.
- Use forward slashes in every path.
- Large references, datasets, and docs cost nothing until read, so bundle them complete rather than summarized.
- Keep one source of truth. If the skill replaces a guide, the skill holds the text; don't maintain both by hand.

## Content
- Cut explanations of things the model already knows (what a PDF is, how libraries work). Ask of each paragraph: does the model need this, and does it justify its tokens?
- Match freedom to fragility. Use prose heuristics where many approaches work, a template or pseudocode where one pattern is preferred, and an exact command with "do not modify it" where one wrong step breaks things.
- Give one default, plus an escape hatch for the case it can't handle ("Use pdfplumber; for scanned PDFs, OCR with pytesseract"). Never list five equal options.
- Pick one term per concept and use it everywhere (always "field", never also "box" or "control").
- Make examples concrete: real inputs and outputs, not placeholders.
- No dates that will go stale ("before August, use the old API"). Describe the current method, and put superseded ones in a collapsed "Old patterns" section.
- Name MCP tools fully as `Server:tool_name`.
- Never assume a package is installed. Name it and how to install it, and check the target runtime allows it (some have no network or package installs).

## Load when the task matches
Read the whole file before starting that part of the task:
- Multistep procedures, checklists, validation loops, output templates, input/output examples, branching workflows → [reference/workflows.md](reference/workflows.md)
- Bundling scripts, validators, or utilities with a skill → [reference/scripts.md](reference/scripts.md)
- Building evaluations, testing across models, iterating on a skill from observed use → [reference/evaluation.md](reference/evaluation.md)
- Writing or editing a project rules file (AGENTS.md, CLAUDE.md) → [reference/rules-files.md](reference/rules-files.md)

## Before finishing
Review the skill against this list. Fix each miss and re-check until the list is clean:
- [ ] The name and description follow the frontmatter limits, and the description says what and when, in third person, with trigger words.
- [ ] The `SKILL.md` body is under 500 lines, and every other file links directly from it with a stated trigger.
- [ ] No paragraph explains what the model already knows. Terminology is consistent, and examples are concrete.
- [ ] Nothing time-sensitive sits outside an "Old patterns" section. All paths use forward slashes.
- [ ] Workflows have numbered steps, and quality-critical ones have a validate-fix-repeat loop.
- [ ] Bundled scripts handle their own errors, justify their constants, and say whether to run or read them.
- [ ] At least three evaluations exist, with a baseline run without the skill, unless the user waived them.
