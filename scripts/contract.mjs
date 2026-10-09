#!/usr/bin/env node
// What does this change do to the contract users and agents rely on?
// (ship skill, COMPAT.md and CI.md rule 10, applied to this repo)
//
//   node scripts/contract.mjs            # compare the working tree with main
//   CONTRACT_BASE=<ref> node scripts/contract.mjs
//
// This repo has no versions: whatever is on main is what `npx skills add`
// installs, so main is the baseline. The contract is what people cite and
// install: skill names, guide files, each skill's one rule, every numbered
// rule's heading, and each description (the trigger). The change gets one
// label — unchanged, additive, changed, breaking — and a list of the promises
// added and removed, printed, written to .contract-report/ (label, summary.md)
// and, on CI, to the job summary. contract-label.yml puts the label on the
// pull request.
//
// It reports and never blocks: a reviewer decides whether a changed promise
// is right (CI.md rule 10, labels as information first). Exits 1 only when it
// can't run at all, such as a missing baseline.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { baselineCommit, REPO_ROOT, tryGit } from "./baseline.mjs";

const SKILL_PAGE = /^skills\/[^/]+\/([^/]+)\/([^/]+\.md)$/;
const RULE_HEADING = /^## (\d+)\. (.+)$/gm;
const ONE_RULE = /^> \*\*([\s\S]+?)\*\*/m;

/** Git, where failing means the report can't run at all. @param {string[]} args */
function git(...args) {
  const out = tryGit(...args);
  if (out === null) {
    console.error(`✗ git ${args.join(" ")} failed`);
    process.exit(1);
  }
  return out;
}

/**
 * Every promise in one tree, as readable strings. Pure over the page reader,
 * so the working tree and the baseline go through the same extraction.
 * @param {string[]} paths repo-relative paths @param {(path: string) => string} read
 */
function promises(paths, read) {
  const found = new Set();
  for (const path of paths) {
    const match = SKILL_PAGE.exec(path);
    if (!match) continue;
    const [, skill, page] = match;
    const text = read(path);
    if (page === "SKILL.md") {
      found.add(`skill ${skill}`);
      const rule = ONE_RULE.exec(text);
      if (rule) found.add(`${skill} one rule: ${rule[1].replace(/\s+/g, " ")}`);
      const description = /^description:\s*>?\s*\n((?:\s+.+\n)+)/m.exec(text);
      if (description) found.add(`${skill} description: ${description[1].replace(/\s+/g, " ").trim()}`);
      continue;
    }
    found.add(`guide ${skill}/${page}`);
    for (const [, n, heading] of text.matchAll(RULE_HEADING)) {
      found.add(`${skill}/${page} rule ${n}: ${heading.trim()}`);
    }
  }
  return found;
}

/** Removing a skill or a guide breaks installs and citations; the rest needs review. */
function labelFor(added, removed) {
  if (removed.some((p) => p.startsWith("skill ") || p.startsWith("guide "))) return "breaking";
  if (removed.length) return "changed";
  if (added.length) return "additive";
  return "unchanged";
}

const base = baselineCommit();
if (!base) {
  console.error("✗ no origin/main to compare with; run `git fetch origin main`");
  process.exit(1);
}
const basePaths = git("ls-tree", "-r", "--name-only", base, "skills").split("\n").filter(Boolean);
// Tracked pages deleted from the working tree are still in the index: skip them.
const headPaths = git("ls-files", "--cached", "--others", "--exclude-standard", "skills")
  .split("\n")
  .filter((path) => path && existsSync(join(REPO_ROOT, path)));
const before = promises(basePaths, (path) => git("show", `${base}:${path}`));
const after = promises(headPaths, (path) => readFileSync(join(REPO_ROOT, path), "utf8"));

const natural = (a, b) => a.localeCompare(b, "en", { numeric: true });
const added = [...after].filter((p) => !before.has(p)).sort(natural);
const removed = [...before].filter((p) => !after.has(p)).sort(natural);
const label = labelFor(added, removed);
const short = git("rev-parse", "--short", base).trim();

const lines = [`## Contract: ${label}`, "", `Against main at ${short}: ${removed.length} promises removed or reworded, ${added.length} added.`];
if (label === "breaking") {
  lines.push("", "A skill or guide was removed or renamed: installs and citations of it break. Say so in the pull request, and keep the old name working if you can.");
}
if (added.length || removed.length) {
  lines.push("", "```diff", ...removed.map((p) => `- ${p}`), ...added.map((p) => `+ ${p}`), "```");
}
const summary = lines.join("\n") + "\n";
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
const report = join(REPO_ROOT, ".contract-report");
mkdirSync(report, { recursive: true });
writeFileSync(join(report, "label"), `${label}\n`);
writeFileSync(join(report, "summary.md"), summary);

const level = { breaking: "warning", changed: "notice" }[label];
if (level && process.env.GITHUB_ACTIONS === "true") {
  console.log(`::${level}::contract ${label} against main: review the promise diff in the job summary`);
}
