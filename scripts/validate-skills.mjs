#!/usr/bin/env node
// Validate the skill collection: frontmatter, description length, link
// resolution, README sync, and orphaned pages.
//
// Run the whole suite, or one tier:
//   node scripts/validate-skills.mjs        # everything
//   node scripts/validate-skills.mjs check  # fast: frontmatter + README sync
//   node scripts/validate-skills.mjs links  # links + orphaned pages
//
// Exits 0 when clean, 1 when any check fails. Every message names the file
// and what to change.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const MAX_DESCRIPTION = 1024;
const SKIP_DIRS = new Set([".git", "node_modules", ".mise", ".venv"]);

/** @param {string} dir @returns {string[]} absolute paths of every .md file */
function collectMarkdown(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectMarkdown(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/**
 * Parse the YAML frontmatter this repo uses: plain scalars, quoted scalars,
 * and folded (`>`) / literal (`|`) block scalars. Returns the fields plus an
 * error string instead of throwing, so the caller can report it as a finding.
 * @param {string} text
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { error: "missing opening `---`" };
  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end === -1) return { error: "missing closing `---`" };

  const fields = {};
  const block = lines.slice(1, end);
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const rest = match[2].trim();

    if (/^[>|][+-]?$/.test(rest)) {
      const folded = rest[0] === ">";
      const body = [];
      while (i + 1 < block.length && (block[i + 1].trim() === "" || /^\s/.test(block[i + 1]))) {
        body.push(block[++i]);
      }
      while (body.length && body[0].trim() === "") body.shift();
      while (body.length && body[body.length - 1].trim() === "") body.pop();
      const indents = body.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
      const indent = indents.length ? Math.min(...indents) : 0;
      const stripped = body.map((l) => l.slice(indent));
      fields[key] = folded ? stripped.join(" ").replace(/\s+/g, " ").trim() : stripped.join("\n");
    } else if (rest.startsWith('"') || rest.startsWith("'")) {
      fields[key] = rest.slice(1, -1);
    } else {
      fields[key] = rest;
    }
  }
  return { fields };
}

/** Drop fenced code blocks and inline code so their brackets aren't read as links. */
function stripCode(text) {
  return text
    .replace(/```[^\n]*\n[\s\S]*?```/g, "")
    .replace(/~~~[^\n]*\n[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

/** Inline markdown/image targets, with external and anchor-only links dropped. */
function extractLinks(text, filePath) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
  for (const match of stripCode(text).matchAll(pattern)) {
    const raw = match[1];
    if (!raw || raw.startsWith("#")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) continue;
    const target = raw.split("#")[0].split("?")[0];
    if (!target) continue;
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      /* keep the raw target */
    }
    const resolved = resolve(dirname(filePath), decoded);
    links.push({ raw, resolved, isDir: target.endsWith("/") });
  }
  return links;
}

const errors = [];
/** @param {string} file absolute path @param {string} message */
const fail = (file, message) => errors.push(`${relative(REPO_ROOT, file)}: ${message}`);

function runCheck(markdownFiles, readme, readmeLinks) {
  const skillFiles = markdownFiles.filter((file) => file.endsWith("SKILL.md"));
  if (skillFiles.length === 0) {
    errors.push("skills/: no SKILL.md files found");
    return;
  }
  const readmeTargets = new Set(readmeLinks.map((link) => link.resolved));

  for (const skill of skillFiles) {
    const text = readFileSync(skill, "utf8");
    const { fields, error } = parseFrontmatter(text);
    if (error) {
      fail(skill, `frontmatter: ${error}`);
      continue;
    }
    if (!fields.name) fail(skill, "frontmatter: missing `name`");
    if (!fields.description) fail(skill, "frontmatter: missing `description`");
    if (fields.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) {
      fail(skill, `frontmatter: name \`${fields.name}\` must be lowercase and hyphenated`);
    }
    const folder = dirname(skill).split(/[\\/]/).pop();
    if (fields.name && fields.name !== folder) {
      fail(skill, `frontmatter: name \`${fields.name}\` does not match folder \`${folder}\``);
    }
    if (fields.description && fields.description.length > MAX_DESCRIPTION) {
      fail(
        skill,
        `frontmatter: description is ${fields.description.length} chars, over the ${MAX_DESCRIPTION} limit`,
      );
    }

    // README must link the skill and every branch guide in its folder.
    if (!readmeTargets.has(skill)) fail(readme, `does not link ${relative(REPO_ROOT, skill)}`);
    const siblings = readdirSync(dirname(skill))
      .filter((name) => name.endsWith(".md") && name !== "SKILL.md")
      .map((name) => join(dirname(skill), name));
    const skillTargets = new Set(extractLinks(text, skill).map((link) => link.resolved));
    for (const guide of siblings) {
      if (!skillTargets.has(guide)) {
        fail(skill, `does not link its branch guide ${relative(REPO_ROOT, guide)}`);
      }
      if (!readmeTargets.has(guide)) {
        fail(readme, `does not link ${relative(REPO_ROOT, guide)}`);
      }
    }
  }
}

function runLinks(markdownFiles) {
  const referenced = new Set();
  for (const file of markdownFiles) {
    const text = readFileSync(file, "utf8");
    for (const { raw, resolved, isDir } of extractLinks(text, file)) {
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
    if (!file.startsWith(SKILLS_DIR + "/") && file !== SKILLS_DIR) continue;
    if (!referenced.has(file)) fail(file, "orphaned page: nothing links to it");
  }
}

const markdownFiles = collectMarkdown(REPO_ROOT);
const readme = join(REPO_ROOT, "README.md");
const readmeLinks = extractLinks(readFileSync(readme, "utf8"), readme);

const tier = process.argv[2] ?? "all";
if (!["all", "check", "links"].includes(tier)) {
  console.error(`unknown tier \`${tier}\`: expected check, links, or all`);
  process.exit(2);
}
if (tier === "all" || tier === "check") runCheck(markdownFiles, readme, readmeLinks);
if (tier === "all" || tier === "links") runLinks(markdownFiles);

if (errors.length) {
  console.error(errors.map((line) => `✗ ${line}`).join("\n"));
  console.error(`\n✗ ${errors.length} error${errors.length === 1 ? "" : "s"}`);
  process.exit(1);
}
const skillCount = markdownFiles.filter((file) => file.endsWith("SKILL.md")).length;
const checked = tier === "all" ? "frontmatter, README sync, links, orphans" : tier === "check" ? "frontmatter, README sync" : "links, orphans";
console.log(`✓ ${checked}: ${skillCount} skill${skillCount === 1 ? "" : "s"}, ${markdownFiles.length} pages`);
