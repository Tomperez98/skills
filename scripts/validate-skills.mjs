#!/usr/bin/env node
// Validate the skill collection: frontmatter, description budget, README sync,
// Hand off and Done when sections, the router's map, link resolution, rule
// references, Skill tool calls, and orphaned pages.
//
// Run the whole suite, or one tier:
//   node scripts/validate-skills.mjs        # everything
//   node scripts/validate-skills.mjs check  # fast: frontmatter, sections, README sync, router map
//   node scripts/validate-skills.mjs links  # links, rule references, Skill calls, orphans
//
// Exits 0 when clean, 1 when any check fails, 2 on a usage error. Every
// message names the file and what to change. Warnings are advisory and do not
// fail the run; the hard description limit stays a fatal error.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { baselineCommit, tryGit } from "./baseline.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const README = join(REPO_ROOT, "README.md");
const AGENTS = join(REPO_ROOT, "AGENTS.md");

const MAX_DESCRIPTION = 1024; // pi's hard ceiling
const DESCRIPTION_BUDGET = 450; // AGENTS.md's "aim for under ~450"
const MAX_SCAN_DEPTH = 16; // our own tree is bounded; deeper is a tool bug
const SKIP_DIRS = new Set([".git", "node_modules", ".mise", ".venv", ".contract-report"]);
const TIER_LABELS = {
  all: "frontmatter, sections, content rules, README sync, router map, links, rule references, Skill calls, orphans",
  check: "frontmatter, sections, content rules, README sync, router map",
  links: "links, rule references, Skill calls, orphans",
};

/**
 * Every `.md` file under `dir`, ignoring vendored trees. Panics on a tree
 * deeper than MAX_SCAN_DEPTH: that is a bug in our own repository, not an
 * expected failure, so it should stop the run loudly rather than hang.
 * @param {string} dir @param {number} [depth]
 * @returns {string[]} absolute paths
 */
function collectMarkdown(dir, depth = 0) {
  if (depth > MAX_SCAN_DEPTH) {
    throw new Error(
      `directory nesting exceeds MAX_SCAN_DEPTH (${MAX_SCAN_DEPTH}) at ${relative(REPO_ROOT, dir)}`,
    );
  }
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectMarkdown(join(dir, entry.name), depth + 1));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/**
 * Parse the YAML frontmatter this repo uses: plain scalars, quoted scalars,
 * and folded (`>`) / literal (`|`) block scalars. Pure, and returns every
 * structural problem instead of throwing, so the caller can report them as
 * findings.
 * @param {string} text
 * @returns {{ fields: Record<string, string>, errors: string[] }}
 */
function parseFrontmatter(text) {
  const errors = [];
  const fields = {};
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0].trim() !== "---") return { fields, errors: ["missing opening `---`"] };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { fields, errors: ["missing closing `---`"] };

  const block = lines.slice(1, end);
  const seen = new Set();
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (!line.trim() || /^\s/.test(line)) continue; // not a top-level field
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const rest = match[2];

    if (seen.has(key)) errors.push(`duplicate field \`${key}\``);
    seen.add(key);

    if (/^[>|][+-]?\d*$/.test(rest.trim())) {
      const folded = rest.trim()[0] === ">";
      const body = [];
      while (i + 1 < block.length && (block[i + 1].trim() === "" || /^\s/.test(block[i + 1]))) {
        body.push(block[++i]);
      }
      fields[key] = renderBlockScalar(body, folded);
      continue;
    }

    const quoted = parseQuotedScalar(rest);
    if (quoted.error) {
      errors.push(`${quoted.error} for \`${key}\``);
      continue;
    }
    fields[key] = quoted.value ?? rest.trim();
  }
  return { fields, errors };
}

/**
 * Read a block scalar into its decoded string. `|` keeps line breaks; `>`
 * folds them to spaces, except around blank and more-indented lines, where
 * YAML keeps the break. Leading/trailing blank lines are clipped.
 * @param {string[]} body @param {boolean} folded
 */
function renderBlockScalar(body, folded) {
  while (body.length && body[0].trim() === "") body.shift();
  while (body.length && body[body.length - 1].trim() === "") body.pop();
  if (body.length === 0) return "";

  const indents = body.filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length);
  const indent = Math.min(...indents);
  const stripped = body.map((line) => line.slice(Math.min(indent, line.length)));
  if (!folded) return stripped.join("\n");

  let foldedText = "";
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i];
    if (i === 0) {
      foldedText = line;
    } else if (line.trim() === "" || stripped[i - 1].trim() === "") {
      foldedText += `\n${line}`;
    } else if (/^[ \t]/.test(line) || /^[ \t]/.test(stripped[i - 1])) {
      foldedText += `\n${line}`; // more-indented lines stay literal
    } else {
      foldedText += ` ${line}`;
    }
  }
  return foldedText;
}

/** Decode a `"…"` or `'…'` scalar; return `{}` when the value is plain. */
function parseQuotedScalar(rest) {
  const quote = rest[0];
  if (quote !== '"' && quote !== "'") return { value: undefined };

  let end = -1;
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] === quote && rest[i - 1] !== "\\") {
      end = i;
      break;
    }
  }
  if (end === -1) return { error: "unterminated quoted scalar" };

  const inner = rest.slice(1, end);
  if (quote === "'") return { value: inner.replace(/''/g, "'") };
  const escapes = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
  return { value: inner.replace(/\\(["\\/bfnrt])/g, (_, char) => escapes[char]) };
}

/** Data flow down: strip fenced blocks, inline code, and HTML comments. */
function stripNonProse(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[^\n]*\n[\s\S]*?```/g, "")
    .replace(/~~~[^\n]*\n[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

const normalizeLabel = (label) => label.replace(/\s+/g, " ").trim().toLowerCase();
const LINK_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm;
const INLINE_LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
const REFERENCE_LINK = /!?\[([^\]]*)\]\[([^\]]*)\]/g;
const SHORTCUT_LINK = /!?\[([^\]]+)\](?![([:])/g;

/**
 * Inline, reference, and shortcut markdown link targets, with external and
 * anchor-only links dropped. Pure: resolves relative to `filePath` so link
 * checks and orphan detection share one extraction.
 * @param {string} text @param {string} filePath
 */
function extractLinks(text, filePath) {
  const prose = stripNonProse(text);
  const links = [];
  const seen = new Set();
  const add = (raw) => {
    if (!raw || raw.startsWith("#")) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return;
    const target = raw.split("#")[0].split("?")[0];
    if (!target) return;
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      /* keep the raw target */
    }
    const resolved = resolve(dirname(filePath), decoded);
    const key = `${resolved}\0${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ raw, resolved, isDir: target.endsWith("/") });
  };

  const definitions = new Map();
  for (const match of prose.matchAll(LINK_DEFINITION)) {
    definitions.set(normalizeLabel(match[1]), match[2]);
  }
  for (const match of prose.matchAll(INLINE_LINK)) add(match[1]);
  for (const match of prose.matchAll(REFERENCE_LINK)) {
    const target = definitions.get(normalizeLabel(match[2] || match[1]));
    if (target) add(target);
  }
  for (const match of prose.matchAll(SHORTCUT_LINK)) {
    const target = definitions.get(normalizeLabel(match[1]));
    if (target) add(target);
  }
  return links;
}

/** Split prose into markdown tables, one entry per `| … |` block. */
function parseTables(text) {
  const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
  const tables = [];
  let table = null;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*\|.*\|\s*$/.test(line)) {
      table = null;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (isSeparator(cells)) continue;
    if (table) table.rows.push(cells);
    else tables.push((table = { header: cells, rows: [] }));
  }
  return tables;
}

const errors = [];
const warnings = [];
/** @param {string} file absolute path @param {string} message */
const fail = (file, message) => errors.push(`${relative(REPO_ROOT, file)}: ${message}`);
/** @param {string} file absolute path @param {string} message */
const warn = (file, message) => warnings.push(`${relative(REPO_ROOT, file)}: ${message}`);

/** Absolute paths of every non-SKILL page in a skill's folder. */
function branchGuides(skill) {
  return readdirSync(dirname(skill))
    .filter((name) => name.endsWith(".md") && name !== "SKILL.md")
    .map((name) => join(dirname(skill), name))
    .sort();
}

const HAND_OFF = /^## Hand off$/m;

/** The lines of a level-two section, from its heading to the next `## ` one. */
function sectionLines(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  return { lines, start, end };
}

/**
 * AGENTS.md: every branch guide closes with an unnumbered `## Done when` of
 * three to five checkable items, and nothing follows the checklist.
 */
function checkDoneWhen(file, text) {
  const section = sectionLines(text, "## Done when");
  if (!section) {
    fail(file, "no `## Done when` section");
    return;
  }
  const { lines, start, end } = section;
  const body = lines.slice(start + 1, end);
  const items = body.filter((line) => /^- /.test(line)).length;
  if (items < 3 || items > 5) {
    fail(file, `\`## Done when\` has ${items} items; expected 3–5`);
  }
  if (end < lines.length) {
    fail(file, `\`## Done when\` must be the last section; found \`${lines[end].trim()}\``);
  }
  for (const line of body) {
    if (line.trim() === "" || /^- /.test(line) || /^\s{2,}\S/.test(line)) continue;
    fail(file, `\`## Done when\` must hold only the checklist; found \`${line.trim()}\``);
    break;
  }
}

/**
 * NEW.md rule 2: the one rule is stated once. The intro blockquote owns it;
 * a second copy in the body is a summary that can drift.
 */
function checkOneRule(file, text) {
  const match = text.match(/^> \*\*([\s\S]*?)\*\*/m);
  if (!match) return;
  const rule = match[1].replace(/\n> ?/g, " ").replace(/\s+/g, " ").trim();
  if (!rule) return;
  const body = text.slice(text.indexOf(match[0]) + match[0].length);
  if (body.includes(rule)) {
    fail(file, "the one rule is restated in the body; state it once and let the guides carry the procedure");
  }
}

/**
 * NEW.md rule 5: a pointer is a trigger plus a target. In `## Pick a branch`,
 * every bullet ends at its guide link instead of summarizing the guide.
 */
function checkPointerSummaries(file, text) {
  const section = sectionLines(text, "## Pick a branch");
  if (!section) return;
  const { lines, start, end } = section;
  let bullet = null;
  const flush = () => {
    if (!bullet) return;
    const link = bullet.match(/\]\([^)]*\.md\)/);
    if (!link) {
      fail(file, `\`## Pick a branch\` bullet has no guide link: ${bullet.trim().slice(0, 80)}`);
    } else {
      const tail = bullet.slice(link.index + link[0].length).trim();
      if (tail !== "" && tail !== ".") {
        fail(file, `\`## Pick a branch\` pointer carries a summary after the link: ${tail.slice(0, 80)}`);
      }
    }
    bullet = null;
  };
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (/^- /.test(line)) {
      flush();
      bullet = line;
    } else if (bullet && /^\s{2,}\S/.test(line)) {
      bullet += ` ${line.trim()}`;
    } else {
      flush();
    }
  }
  flush();
}

/**
 * AGENTS.md's per-skill guide list is an index. It must match the files on
 * disk, or an agent reading it misses branches.
 */
function checkAgentsGuideList(skillFiles) {
  if (!existsSync(AGENTS)) return;
  const lines = readFileSync(AGENTS, "utf8").split(/\r?\n/);
  const listed = new Map();
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- `skills\/([^`]+)\/` — (.*)$/);
    if (!match) continue;
    let body = match[2];
    let j = i + 1;
    while (j < lines.length && /^\s{2,}\S/.test(lines[j])) {
      body += ` ${lines[j].trim()}`;
      j++;
    }
    listed.set(match[1], body.split(/\.(?:\s|$)/)[0]);
  }
  for (const [folder] of listed) {
    const skill = skillFiles.find(
      (file) => posix(dirname(file)).replace(/^skills\//, "") === folder,
    );
    if (!skill) {
      fail(AGENTS, `guide list names \`skills/${folder}/\`, which has no SKILL.md`);
    }
  }
  for (const skill of skillFiles) {
    const guides = branchGuides(skill).map((guide) => basename(guide, ".md"));
    if (guides.length === 0) continue;
    const folder = posix(dirname(skill)).replace(/^skills\//, "");
    const body = listed.get(folder);
    if (!body) {
      fail(AGENTS, `guide list has no entry for \`skills/${folder}/\``);
      continue;
    }
    const names = body.split(",").map((name) => name.trim()).filter(Boolean);
    const missing = guides.filter((guide) => !names.includes(guide));
    const extra = names.filter((name) => !guides.includes(name));
    if (missing.length > 0) {
      fail(AGENTS, `guide list for \`skills/${folder}/\` omits ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      fail(AGENTS, `guide list for \`skills/${folder}/\` names missing guides ${extra.join(", ")}`);
    }
  }
}

const SMALL_NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A README count written as digits or as English below one hundred. */
function wordToNumber(word) {
  if (/^\d+$/.test(word)) return Number(word);
  const parts = word.toLowerCase().split("-");
  const small = SMALL_NUMBERS.indexOf(parts[0]);
  if (parts.length === 1 && small !== -1) return small;
  const tens = TENS.indexOf(parts[0]);
  if (tens === -1) return undefined;
  if (parts.length === 1) return (tens + 2) * 10;
  const ones = SMALL_NUMBERS.indexOf(parts[1]);
  return ones >= 0 && ones < 10 ? (tens + 2) * 10 + ones : undefined;
}

/**
 * The README's "N branch guides, M numbered rules" line is a claim about the
 * files on disk. Compute the counts instead of trusting the prose.
 */
function checkReadmeCounts(readme, text, markdownFiles) {
  const match = text.match(/([A-Za-z]+(?:-[A-Za-z]+)?|\d+)\s+branch guides,\s+(\d+)\s+numbered rules/);
  if (!match) {
    fail(readme, "missing the `N branch guides, M numbered rules` summary");
    return;
  }
  const claimedGuides = wordToNumber(match[1]);
  const claimedRules = Number(match[2]);
  const guides = markdownFiles.filter((file) => isUnderSkills(file) && basename(file) !== "SKILL.md");
  const rules = guides.reduce((total, file) => total + ruleHeadings(readFileSync(file, "utf8")).size, 0);
  if (!Number.isInteger(claimedGuides)) {
    fail(readme, `cannot read the branch-guide count \`${match[1]}\``);
  } else if (claimedGuides !== guides.length) {
    fail(readme, `says ${claimedGuides} branch guides; found ${guides.length}`);
  }
  if (claimedRules !== rules) {
    fail(readme, `says ${claimedRules} numbered rules; found ${rules}`);
  }
}

function runCheck(markdownFiles, readme, readmeText, readmeLinks) {
  const skillFiles = markdownFiles.filter((file) => file.endsWith("SKILL.md"));
  if (skillFiles.length === 0) {
    errors.push("skills/: no SKILL.md files found");
    return;
  }
  const readmeTargets = new Set(readmeLinks.map((link) => link.resolved));
  const seenNames = new Map();

  for (const skill of skillFiles) {
    const text = readFileSync(skill, "utf8");
    const { fields, errors: parseErrors } = parseFrontmatter(text);
    for (const error of parseErrors) fail(skill, `frontmatter: ${error}`);

    if (!fields.name) fail(skill, "frontmatter: missing `name`");
    if (!fields.description) fail(skill, "frontmatter: missing `description`");

    if (fields.name) {
      const folder = basename(dirname(skill));
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) {
        fail(skill, `frontmatter: name \`${fields.name}\` must be lowercase and hyphenated`);
      }
      if (fields.name !== folder) {
        fail(skill, `frontmatter: name \`${fields.name}\` does not match folder \`${folder}\``);
      }
      const prior = seenNames.get(fields.name);
      if (prior) {
        fail(skill, `frontmatter: name \`${fields.name}\` already used by ${relative(REPO_ROOT, prior)}`);
      } else {
        seenNames.set(fields.name, skill);
      }
    }

    if (fields.description) {
      const length = fields.description.length;
      if (length > MAX_DESCRIPTION) {
        fail(skill, `frontmatter: description is ${length} chars, over the ${MAX_DESCRIPTION} limit`);
      } else if (length > DESCRIPTION_BUDGET) {
        warn(skill, `description is ${length} chars, over the ~${DESCRIPTION_BUDGET} budget — tighten it`);
      }
    }

    // AGENTS.md: every SKILL.md names its transitions to other skills, states
    // its one rule once, and points without summarizing.
    if (!HAND_OFF.test(text)) fail(skill, "no `## Hand off` section");
    checkOneRule(skill, text);
    checkPointerSummaries(skill, text);
    for (const guide of branchGuides(skill)) {
      checkDoneWhen(guide, readFileSync(guide, "utf8"));
    }

    // README must link the skill and every branch guide in its folder.
    if (!readmeTargets.has(skill)) fail(readme, `does not link ${relative(REPO_ROOT, skill)}`);
    const linkTargets = new Set(extractLinks(text, skill).map((link) => link.resolved));
    for (const guide of branchGuides(skill)) {
      if (!linkTargets.has(guide)) {
        fail(skill, `does not link its branch guide ${relative(REPO_ROOT, guide)}`);
      }
      if (!readmeTargets.has(guide)) {
        fail(readme, `does not link ${relative(REPO_ROOT, guide)}`);
      }
    }
  }

  checkReadmeTable(readme, readmeText, skillFiles);
  checkReadmeCounts(readme, readmeText, markdownFiles);
  checkAgentsGuideList(skillFiles);
  checkRouterMap(skillFiles);
}

/**
 * A router is a user-invoked skill with no branch guides of its own (AGENTS.md:
 * `ask`). Its map must name every other skill and every guide they have, so a
 * new guide can't land without a route to it.
 */
function checkRouterMap(skillFiles) {
  const routers = skillFiles.filter(
    (skill) =>
      branchGuides(skill).length === 0 &&
      parseFrontmatter(readFileSync(skill, "utf8")).fields["disable-model-invocation"] === "true",
  );
  for (const router of routers) {
    const words = new Set(stripNonProse(readFileSync(router, "utf8")).match(/[A-Za-z_][A-Za-z_-]*/g));
    for (const skill of skillFiles) {
      if (skill === router) continue;
      const name = basename(dirname(skill));
      if (!words.has(name)) fail(router, `map never names the \`${name}\` skill`);
      for (const guide of branchGuides(skill)) {
        const stem = basename(guide, ".md");
        if (!words.has(stem)) fail(router, `map has no route to ${name}'s ${stem}`);
      }
    }
  }
}

/** The README's `Skill` table must have one row per skill naming every guide. */
function checkReadmeTable(readme, readmeText, skillFiles) {
  const table = parseTables(stripNonProse(readmeText)).find((t) =>
    t.header.some((cell) => /^skill$/i.test(cell)),
  );
  if (!table) {
    fail(readme, "no skill table found (need a table with a `Skill` column)");
    return;
  }
  const linksFor = (row) => extractLinks(row[0] ?? "", readme).map((link) => link.resolved);

  for (const skill of skillFiles) {
    const row = table.rows.find((candidate) => linksFor(candidate).includes(skill));
    if (!row) {
      fail(readme, `skill table has no row for ${relative(REPO_ROOT, skill)}`);
      continue;
    }
    const tokens = new Set(row.join(" ").match(/[A-Za-z0-9_]+/g) ?? []);
    for (const guide of branchGuides(skill)) {
      const name = basename(guide, ".md");
      if (!tokens.has(name)) {
        fail(readme, `skill table row for \`${relative(REPO_ROOT, skill)}\` omits branch guide ${name}`);
      }
    }
  }

  for (const row of table.rows) {
    if (!skillFiles.some((skill) => linksFor(row).includes(skill))) {
      fail(readme, `skill table row \`${(row[0] ?? "").trim()}\` does not link a SKILL.md`);
    }
  }
}

// `call the Skill tool with "ship" and follow its CI.md, then RELEASE.md.`
// The clause runs to the sentence's end: a period before whitespace, a colon,
// a semicolon, or a closing parenthesis. A `.md` inside it is no boundary.
const SKILL_CALL = /call\s+the\s+Skill\s+tool\s+with\s+"([^"]+)"([\s\S]*?)(?:\.(?=\s|$)|[:;)]|$)/gi;
const GUIDE_NAME = /\b[A-Z][A-Z_]*\.md\b/g;

/**
 * Every instruction to load another skill names a skill that exists, and every
 * guide it says to follow exists in that skill's folder. A rename that misses
 * one leaves the agent loading the right skill and opening a missing page.
 */
function checkSkillCalls(markdownFiles) {
  const skillDirs = new Map(
    markdownFiles
      .filter((file) => file.endsWith("SKILL.md"))
      .map((file) => [basename(dirname(file)), dirname(file)]),
  );
  for (const file of markdownFiles) {
    const text = tidy(readFileSync(file, "utf8").replace(/`/g, ""));
    for (const [, name, clause] of text.matchAll(SKILL_CALL)) {
      const dir = skillDirs.get(name);
      if (!dir) {
        fail(file, `Skill tool call names "${name}", which is not a skill`);
        continue;
      }
      for (const guide of clause.match(GUIDE_NAME) ?? []) {
        if (!existsSync(join(dir, guide))) {
          fail(file, `Skill tool call to "${name}" says to follow ${guide}, which ${name} doesn't have`);
        }
      }
    }
  }
}

/** True when `file` lives under skills/, using path segments (Windows-safe). */
function isUnderSkills(file) {
  const rel = relative(SKILLS_DIR, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function runLinks(markdownFiles) {
  const referenced = new Set();
  for (const file of markdownFiles) {
    for (const { raw, resolved, isDir } of extractLinks(readFileSync(file, "utf8"), file)) {
      let exists = false;
      try {
        const stats = statSync(resolved);
        exists = isDir ? stats.isDirectory() : stats.isFile() || stats.isDirectory();
      } catch {
        exists = false;
      }
      if (!exists) fail(file, `broken link: ${raw}`);
      if (resolved !== file) referenced.add(resolved);
    }
  }

  for (const file of markdownFiles) {
    if (!isUnderSkills(file)) continue;
    if (!referenced.has(file)) {
      fail(file, "orphaned page: nothing links to it — link it from README.md or a sibling");
    }
  }
}

const RULE_HEADING = /^## (\d+)\. (.+)$/gm;
// "COMPAT.md rule 6", "ship skill, COMPAT.md rules 8–12", "(code skill, WRITE.md rule 28)"
const QUALIFIED_RULE_REF = /(?:\b([a-z]+) skill,\s+)?\b([A-Z][A-Z_]*\.md)\s+rules?\s+(\d+)(?:\s*[–-]\s*(\d+))?/gi;
// "rule 6", "rules 13–14": a rule in the same page
const LOCAL_RULE_REF = /\brules?\s+(\d+)(?:\s*[–-]\s*(\d+))?/gi;

/** A page's numbered rules (`## N. Heading`): number → heading. */
function ruleHeadings(text) {
  return new Map([...text.matchAll(RULE_HEADING)].map((m) => [Number(m[1]), m[2].trim()]));
}

/**
 * The page a `FILE.md rule N` reference means: the named skill's page, else a
 * sibling of the citing page, else the only page with that name. Returns
 * `{ error }` when the name is missing or ambiguous.
 */
function resolveRulePage(name, skill, citing, markdownFiles) {
  const pages = markdownFiles.filter((file) => isUnderSkills(file) && basename(file) === name);
  if (skill) {
    const page = pages.find((file) => basename(dirname(file)) === skill);
    return page ? { page } : { error: `${skill} skill has no ${name}` };
  }
  const sibling = join(dirname(citing), name);
  if (pages.includes(sibling)) return { page: sibling };
  if (pages.length === 1) return { page: pages[0] };
  if (pages.length === 0) return { error: `no page named ${name}` };
  const skills = pages.map((file) => basename(dirname(file))).join(", ");
  return { error: `${name} is ambiguous (${skills}); write "<skill> skill, ${name}"` };
}

const tidy = (text) => text.replace(/\s+/g, " ");
const posix = (file) => relative(REPO_ROOT, file).split(sep).join("/");

/**
 * Every rule citation in a page: the page it cites, the number, the
 * citation as written, and the line it sits on (its identity across edits).
 */
function citations(text, file, markdownFiles) {
  const found = [];
  const lineAt = (prose, index) =>
    prose.slice(prose.lastIndexOf("\n", index) + 1, (prose.indexOf("\n", index) + 1 || prose.length + 1) - 1);
  let prose = stripNonProse(text).replace(RULE_HEADING, "");
  for (const m of prose.matchAll(QUALIFIED_RULE_REF)) {
    const [ref, skill, name, from, to] = m;
    const { page, error } = resolveRulePage(name, skill?.toLowerCase(), file, markdownFiles);
    for (const n of to ? [from, to] : [from]) {
      found.push({ ref: tidy(ref), page, error, n: Number(n), line: lineAt(prose, m.index) });
    }
  }
  prose = prose.replace(QUALIFIED_RULE_REF, "");
  for (const m of prose.matchAll(LOCAL_RULE_REF)) {
    const [ref, from, to] = m;
    for (const n of to ? [from, to] : [from]) {
      found.push({ ref: tidy(ref), page: file, local: true, n: Number(n), line: lineAt(prose, m.index) });
    }
  }
  return found;
}

/**
 * Guides cite each other by rule number ("CI.md rule 7"). Every cited rule
 * must exist, and must still be the rule the citation meant.
 */
function checkRuleReferences(markdownFiles) {
  const headings = new Map(markdownFiles.map((file) => [file, ruleHeadings(readFileSync(file, "utf8"))]));
  const cited = new Map();
  for (const file of markdownFiles) {
    const list = citations(readFileSync(file, "utf8"), file, markdownFiles);
    cited.set(file, list);
    for (const c of list) {
      if (c.error) fail(file, `"${c.ref}": ${c.error}`);
      else if (!headings.get(c.page).has(c.n)) {
        fail(file, c.local
          ? `"${c.ref}": this page has no rule ${c.n}; name the guide ("CI.md rule ${c.n}") or fix the number`
          : `"${c.ref}": ${relative(REPO_ROOT, c.page)} has no rule ${c.n}`);
      }
    }
  }
  checkCitationMeaning(markdownFiles, headings, cited);
}

/**
 * A citation that resolves can still be wrong: insert a rule and every later
 * number shifts, so "RELEASE.md rule 3" quietly points at a different rule.
 * Compare with main: a citation on a line this change didn't touch, whose
 * rule now sits under another number, has gone stale. A citation on an
 * edited line is trusted: someone just wrote it.
 */
function checkCitationMeaning(markdownFiles, headings, cited) {
  const base = baselineCommit();
  if (!base) {
    warn(README, "no origin/main to compare with, so citations weren't checked for shifted rule numbers; run `git fetch origin main`");
    return;
  }
  const headingsOnMain = new Map();
  const onMain = (page) => {
    if (!headingsOnMain.has(page)) {
      const text = tryGit("show", `${base}:${posix(page)}`);
      headingsOnMain.set(page, text === null ? null : ruleHeadings(text));
    }
    return headingsOnMain.get(page);
  };
  for (const file of markdownFiles) {
    const old = tryGit("show", `${base}:${posix(file)}`);
    if (old === null) continue; // a new page: nothing to have shifted
    const untouched = new Set(
      citations(old, file, markdownFiles).filter((c) => !c.error).map((c) => `${c.page}\0${c.n}\0${c.line}`),
    );
    for (const c of cited.get(file)) {
      if (c.error || !untouched.has(`${c.page}\0${c.n}\0${c.line}`)) continue;
      const meant = onMain(c.page)?.get(c.n);
      const now = headings.get(c.page).get(c.n);
      if (!meant || meant === now) continue;
      const moved = [...headings.get(c.page)].find(([, heading]) => heading === meant);
      if (moved) {
        fail(file, `"${c.ref}" meant "${meant}", which is now rule ${moved[0]}; rule ${c.n} is "${now}"`);
      }
    }
  }
}

function report(markdownFiles, skillCount, tier) {
  const uniqueErrors = [...new Set(errors)].sort();
  const uniqueWarnings = [...new Set(warnings)].sort();
  for (const message of uniqueWarnings) console.error(`! ${message}`);
  for (const message of uniqueErrors) console.error(`✗ ${message}`);

  if (uniqueErrors.length) {
    const warningNote = uniqueWarnings.length
      ? `, ${uniqueWarnings.length} warning${uniqueWarnings.length === 1 ? "" : "s"}`
      : "";
    console.error(`\n✗ ${uniqueErrors.length} error${uniqueErrors.length === 1 ? "" : "s"}${warningNote}`);
    process.exit(1);
  }
  const warningNote = uniqueWarnings.length
    ? ` — ${uniqueWarnings.length} warning${uniqueWarnings.length === 1 ? "" : "s"}`
    : "";
  console.log(
    `✓ ${TIER_LABELS[tier]}: ${skillCount} skill${skillCount === 1 ? "" : "s"}, ` +
      `${markdownFiles.length} pages${warningNote}`,
  );
}

const tier = process.argv[2] ?? "all";
if (!Object.hasOwn(TIER_LABELS, tier)) {
  console.error(`unknown tier \`${tier}\`: expected check, links, or all`);
  process.exit(2);
}

const markdownFiles = collectMarkdown(REPO_ROOT);
const readmeText = readFileSync(README, "utf8");
if (tier === "all" || tier === "check") {
  runCheck(markdownFiles, README, readmeText, extractLinks(readmeText, README));
}
if (tier === "all" || tier === "links") {
  runLinks(markdownFiles);
  checkRuleReferences(markdownFiles);
  checkSkillCalls(markdownFiles);
}

const skillCount = markdownFiles.filter((file) => file.endsWith("SKILL.md")).length;
report(markdownFiles, skillCount, tier);
