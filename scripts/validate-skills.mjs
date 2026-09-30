#!/usr/bin/env node
// Validate the skill collection: frontmatter, description budget, README sync,
// link resolution, and orphaned pages.
//
// Run the whole suite, or one tier:
//   node scripts/validate-skills.mjs        # everything
//   node scripts/validate-skills.mjs check  # fast: frontmatter + README sync
//   node scripts/validate-skills.mjs links  # links + orphaned pages
//
// Exits 0 when clean, 1 when any check fails, 2 on a usage error. Every
// message names the file and what to change. Warnings are advisory and do not
// fail the run; the hard description limit stays a fatal error.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const README = join(REPO_ROOT, "README.md");

const MAX_DESCRIPTION = 1024; // pi's hard ceiling
const DESCRIPTION_BUDGET = 450; // AGENTS.md's "aim for under ~450"
const MAX_SCAN_DEPTH = 16; // our own tree is bounded; deeper is a tool bug
const SKIP_DIRS = new Set([".git", "node_modules", ".mise", ".venv"]);
const TIER_LABELS = {
  all: "frontmatter, README sync, links, orphans",
  check: "frontmatter, README sync",
  links: "links, orphans",
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
if (tier === "all" || tier === "links") runLinks(markdownFiles);

const skillCount = markdownFiles.filter((file) => file.endsWith("SKILL.md")).length;
report(markdownFiles, skillCount, tier);
