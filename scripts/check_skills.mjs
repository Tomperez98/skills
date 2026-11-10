#!/usr/bin/env node
/**
 * Check every skill under skills/ against the rules in skills/writing-skills.
 *
 * Run:  node scripts/check_skills.mjs [--root DIR] [--strict]
 *       (or `mise run check-skills`, which is what CI calls)
 *
 * Prints one line per finding, `path: [rule] message`, and exits 0 when clean,
 * 1 when there are errors (or warnings under --strict), 2 on bad usage.
 *
 * Only Node built-ins are used, so there is nothing to install. Judgment rules
 * (does each token earn its place, one term per concept, are examples concrete)
 * are not checkable here; the evals cover them.
 *
 * Layout: parsing and checks are pure functions of text; the `load*`,
 * `syntaxProblem`, and `main` functions are the only code that touches the
 * disk or spawns a process.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

// 20: the oldest Node line still in maintenance when this was written; mise.toml
// pins the version CI and laptops run, this only gives a clear error on older ones.
export const MIN_NODE_MAJOR = 20;

// Limits quoted from skills/writing-skills/SKILL.md.
export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
export const BODY_MAX_LINES = 500;
// 80% of the limit: the rule says to split before reaching 500, so warn early.
export const BODY_WARN_LINES = 400;
export const REFERENCE_TOC_OVER_LINES = 100;
// 30: a partial read such as `head -100` must still show the table of contents.
export const TOC_WINDOW_LINES = 30;
// 3 anchor links in the window is the smallest list that reads as a TOC.
export const TOC_MIN_ANCHORS = 3;
// 3 is the minimum number of evaluations the rule asks for.
export const MIN_EVALS = 3;
// One task word is enough ("README → [..]"); filler alone ("See also") is not.
export const MIN_TRIGGER_WORDS = 1;
const FILLER_WORDS = new Set([
  "see", "also", "read", "link", "refer", "more", "details", "info", "docs", "here",
]);

const RESERVED_NAME_WORDS = ["anthropic", "claude"];
// Names the rule calls vague. Compared per hyphen-separated word.
const VAGUE_NAME_WORDS = ["helper", "helpers", "utils", "util", "files", "tools", "misc"];
const GENERIC_FILE_STEM = /^(doc|file|ref|reference|notes|misc|other|temp|tmp)\d*$/;

export const ERROR = "error";
export const WARNING = "warning";

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?" +
  "|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const STALE_DATE_PATTERNS = [
  /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/,
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+(?:\\d{1,2},?\\s+)?(?:19|20)\\d{2}\\b`, "i"),
  new RegExp(
    `\\b(?:before|after|until|since|as of|starting|beginning)\\s+(?:${MONTHS})\\b`,
    "i",
  ),
  /\bQ[1-4]\s+(?:19|20)\d{2}\b/,
];
// Regexes with the `g` flag are used only with replace/matchAll, never test/exec,
// so a stale `lastIndex` cannot leak between calls.
const XML_TAG = /<\/?[A-Za-z][^>]*>/;
const LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BACKSLASH_PATH =
  /[\w.-]+(?:\\[\w.-]+)+\.(?:md|py|sh|json|txt|mjs|cjs|js|ts|yml|yaml)\b/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FIRST_PERSON = /\b(?:I|I'm|I'll|I've|me|my|we|our)\b/;
const SECOND_PERSON = /\b(?:you|your|yours)\b/i;
const QUOTED = /"[^"]*"|“[^”]*”/g;
const RUN_OR_READ = /\b(?:run|runs|running|execute|read|see|view)\b/i;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export class Finding {
  /**
   * @param {string} path repo-relative, forward slashes
   * @param {string} rule
   * @param {string} message
   * @param {"error" | "warning"} severity
   */
  constructor(path, rule, message, severity = ERROR) {
    this.path = path;
    this.rule = rule;
    this.message = message;
    this.severity = severity;
    Object.freeze(this);
  }
}

/**
 * A skill directory. `files` maps a path relative to the skill directory
 * (forward slashes) to its text, or null for a non-text file.
 */
export class Skill {
  /**
   * @param {string} dirName
   * @param {string} relPath e.g. "skills/writing-code"
   * @param {Map<string, string | null>} files
   */
  constructor(dirName, relPath, files = new Map()) {
    this.dirName = dirName;
    this.relPath = relPath;
    this.files = files;
  }

  /** @returns {string | null} */
  get skillMd() {
    return this.files.get("SKILL.md") ?? null;
  }
}

// --------------------------------------------------------------------------
// Small helpers (pure)
// --------------------------------------------------------------------------

const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (items) => [...items].sort(byCode);
const sortedEntries = (map) => [...map.entries()].sort((a, b) => byCode(a[0], b[0]));

/** Quote a string the way a reader expects in a message: 'name'. */
export function repr(value) {
  const s = String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replaceAll("'", "\\'")}'`;
}

const dirname = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const basename = (p) => p.slice(p.lastIndexOf("/") + 1);
const lineCount = (text) => text.split("\n").length;

/** POSIX path normalization: collapses `.`, `..`, and repeated slashes. */
export function normpath(p) {
  const absolute = p.startsWith("/");
  const out = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
    } else {
      out.push(part);
    }
  }
  const joined = out.join("/");
  return absolute ? `/${joined}` : joined || ".";
}

// --------------------------------------------------------------------------
// Parsing helpers (pure)
// --------------------------------------------------------------------------

/**
 * Only single-line `key: value` pairs are supported, which is all the skill
 * format needs.
 * @returns {{front: {fields: Map<string, string>, body: string} | null, problem: string | null}}
 */
export function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") {
    return { front: null, problem: "SKILL.md must start with a `---` frontmatter line" };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { front: null, problem: "frontmatter is not closed: add a closing `---` line" };
  }
  const fields = new Map();
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    const key = colon === -1 ? "" : line.slice(0, colon);
    if (colon === -1 || !key.trim() || key !== key.trim()) {
      return {
        front: null,
        problem: `frontmatter line ${i + 1} is not a single-line \`key: value\` pair: ${repr(line)}`,
      };
    }
    fields.set(key.trim(), line.slice(colon + 1).trim().replace(/^["']+|["']+$/g, ""));
  }
  return { front: { fields, body: lines.slice(end + 1).join("\n") }, problem: null };
}

/**
 * Blank fenced blocks and inline code spans, keeping line numbers, so examples
 * are not mistaken for claims or links.
 */
export function stripCode(text) {
  const out = [];
  let fence = null;
  for (const line of text.split("\n")) {
    const marker = line.trimStart().slice(0, 3);
    if (fence === null && (marker === "```" || marker === "~~~")) {
      fence = marker;
      out.push("");
    } else if (fence !== null) {
      if (marker === fence) fence = null;
      out.push("");
    } else {
      out.push(line.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length)));
    }
  }
  return out.join("\n");
}

/** Each Markdown link outside code: its 1-based line number, text, and target. */
export function extractLinks(text) {
  const found = [];
  stripCode(text)
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(LINK)) {
        found.push({ number: index + 1, label: match[1], target: match[2] });
      }
    });
  return found;
}

/**
 * Resolve a link target against the file holding it. Returns a normalized path
 * relative to the skill directory ('..' prefixes kept), or null for URLs and
 * same-page anchors.
 */
export function resolveLocal(source, target) {
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    decoded = target; // a stray `%` is not an escape; use the text as written
  }
  const bare = decoded.split("#")[0].split("?")[0];
  if (!bare || SCHEME.test(bare)) return null;
  const dir = dirname(source);
  return normpath(bare.startsWith("/") || !dir ? bare : `${dir}/${bare}`);
}

function linkedFromDirect(skill) {
  const direct = new Set();
  for (const { target } of extractLinks(skill.skillMd ?? "")) {
    const resolved = resolveLocal("SKILL.md", target);
    if (resolved !== null) direct.add(resolved);
  }
  return direct;
}

// --------------------------------------------------------------------------
// Per-skill checks (pure): Skill -> Finding[]
// --------------------------------------------------------------------------

export function checkFrontmatter(skill) {
  const where = `${skill.relPath}/SKILL.md`;
  if (skill.skillMd === null) {
    return [new Finding(where, "skill-md-missing", "SKILL.md is missing; every skill needs one")];
  }
  const { front, problem } = parseFrontmatter(skill.skillMd);
  if (front === null) return [new Finding(where, "frontmatter", problem)];

  const findings = [];
  const name = front.fields.get("name") ?? "";
  if (!name) {
    findings.push(new Finding(where, "name", "`name` is missing or empty"));
  } else {
    if (name.length > NAME_MAX) {
      findings.push(
        new Finding(where, "name", `\`name\` is ${name.length} characters, the limit is ${NAME_MAX}`),
      );
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      findings.push(
        new Finding(
          where,
          "name",
          `\`name\` ${repr(name)} must use only lowercase letters, digits, and hyphens`,
        ),
      );
    }
    for (const word of RESERVED_NAME_WORDS) {
      if (name.includes(word)) {
        findings.push(
          new Finding(where, "name", `\`name\` ${repr(name)} contains the reserved word ${repr(word)}`),
        );
      }
    }
    if (XML_TAG.test(name)) {
      findings.push(new Finding(where, "name", `\`name\` ${repr(name)} must not contain XML tags`));
    }
    const vague = name.split("-").filter((w) => VAGUE_NAME_WORDS.includes(w));
    if (vague.length) {
      findings.push(
        new Finding(
          where,
          "name-vague",
          `\`name\` ${repr(name)} contains the vague word ${repr(vague[0])}; ` +
            "name the activity, e.g. `processing-pdfs`",
        ),
      );
    }
    if (name !== skill.dirName) {
      findings.push(
        new Finding(
          where,
          "name-dir",
          `\`name\` ${repr(name)} must equal its directory name ${repr(skill.dirName)}`,
        ),
      );
    }
  }

  const description = front.fields.get("description") ?? "";
  if (!description) {
    findings.push(new Finding(where, "description", "`description` is missing or empty"));
  } else {
    if (description.length > DESCRIPTION_MAX) {
      findings.push(
        new Finding(
          where,
          "description",
          `\`description\` is ${description.length} characters, the limit is ${DESCRIPTION_MAX}`,
        ),
      );
    }
    if (XML_TAG.test(description)) {
      findings.push(new Finding(where, "description", "`description` must not contain XML tags"));
    }
    const unquoted = description.replace(QUOTED, "");
    const person = unquoted.match(FIRST_PERSON) ?? unquoted.match(SECOND_PERSON);
    if (person) {
      findings.push(
        new Finding(
          where,
          "description-person",
          `\`description\` uses ${repr(person[0])}; write it in third person ` +
            '("Extracts text from PDFs")',
        ),
      );
    }
    if (!/\buse when\b/i.test(description)) {
      findings.push(
        new Finding(
          where,
          "description-trigger",
          "`description` has no 'Use when ...' clause naming the triggers",
          WARNING,
        ),
      );
    }
  }
  return findings;
}

export function checkBodySize(skill) {
  if (skill.skillMd === null) return [];
  const { front } = parseFrontmatter(skill.skillMd);
  const body = front ? front.body : skill.skillMd;
  const lines = lineCount(body.replace(/\n+$/, ""));
  const where = `${skill.relPath}/SKILL.md`;
  if (lines >= BODY_MAX_LINES) {
    return [
      new Finding(
        where,
        "body-size",
        `body is ${lines} lines, the limit is under ${BODY_MAX_LINES}; ` +
          "move area-specific rules into reference files",
      ),
    ];
  }
  if (lines >= BODY_WARN_LINES) {
    return [
      new Finding(
        where,
        "body-size",
        `body is ${lines} lines; split before reaching ${BODY_MAX_LINES}`,
        WARNING,
      ),
    ];
  }
  return [];
}

/**
 * Broken links, links leaving the skill, files not linked from SKILL.md, and
 * links without a trigger.
 */
export function checkLinks(skill) {
  const findings = [];
  /** @type {Map<string, Set<string>>} target -> files linking it */
  const linkedFrom = new Map();
  for (const [rel, text] of sortedEntries(skill.files)) {
    if (text === null || !rel.endsWith(".md")) continue;
    for (const { number, target } of extractLinks(text)) {
      const resolved = resolveLocal(rel, target);
      const where = `${skill.relPath}/${rel}:${number}`;
      if (resolved === null) continue;
      if (resolved === ".." || resolved.startsWith("../")) {
        findings.push(
          new Finding(
            where,
            "link-outside",
            `link ${repr(target)} leaves the skill directory; skills install ` +
              "one by one, so copy the text in or link within the skill",
            WARNING,
          ),
        );
        continue;
      }
      const isDir = [...skill.files.keys()].some((f) => f.startsWith(`${resolved}/`));
      if (!skill.files.has(resolved) && !isDir) {
        findings.push(
          new Finding(where, "link-broken", `link ${repr(target)} points at no file in the skill`),
        );
        continue;
      }
      if (!linkedFrom.has(resolved)) linkedFrom.set(resolved, new Set());
      linkedFrom.get(resolved).add(rel);
    }
  }

  const skillMd = skill.skillMd ?? "";
  const direct = linkedFromDirect(skill);
  for (const rel of sorted(skill.files.keys())) {
    if (rel === "SKILL.md" || direct.has(rel)) continue;
    // A script or asset named by path in SKILL.md counts as referenced.
    if (!rel.endsWith(".md") && skillMd.includes(rel)) continue;
    const others = sorted([...(linkedFrom.get(rel) ?? [])].filter((f) => f !== "SKILL.md"));
    const reason = others.length
      ? `is linked only from ${others[0]}; link it directly from SKILL.md`
      : "is linked from nowhere; link it from SKILL.md with the task that needs it";
    findings.push(new Finding(`${skill.relPath}/${rel}`, "file-unlinked", `${rel} ${reason}`));
  }

  const skillMdLines = skillMd.split("\n");
  for (const { number, target } of extractLinks(skillMd)) {
    const resolved = resolveLocal("SKILL.md", target);
    if (resolved === null || !skill.files.has(resolved)) continue;
    const withoutLink = skillMdLines[number - 1].replace(LINK, " ");
    const words = (withoutLink.match(/[A-Za-z]{2,}/g) ?? []).filter(
      (w) => !FILLER_WORDS.has(w.toLowerCase()),
    );
    if (words.length < MIN_TRIGGER_WORDS) {
      findings.push(
        new Finding(
          `${skill.relPath}/SKILL.md:${number}`,
          "link-trigger",
          `link to ${repr(target)} names no task; write 'Task → [file](file)' ` +
            "so the model knows when to read it",
          WARNING,
        ),
      );
    }
  }
  return findings;
}

export function checkReferenceToc(skill) {
  const findings = [];
  for (const [rel, text] of sortedEntries(skill.files)) {
    if (text === null || !rel.endsWith(".md") || rel === "SKILL.md") continue;
    const lines = text.split("\n");
    if (lines.length <= REFERENCE_TOC_OVER_LINES) continue;
    const window = lines.slice(0, TOC_WINDOW_LINES).join("\n");
    const anchors = (window.match(/\]\(#/g) ?? []).length;
    const hasHeading = /^#{1,6}\s+(?:table of )?contents\b/im.test(window);
    if (!hasHeading && anchors < TOC_MIN_ANCHORS) {
      findings.push(
        new Finding(
          `${skill.relPath}/${rel}`,
          "reference-toc",
          `${rel} is ${lines.length} lines (over ${REFERENCE_TOC_OVER_LINES}) with no ` +
            `table of contents in its first ${TOC_WINDOW_LINES} lines`,
        ),
      );
    }
  }
  return findings;
}

export function checkPaths(skill) {
  const findings = [];
  for (const [rel, text] of sortedEntries(skill.files)) {
    if (text === null || !rel.endsWith(".md")) continue;
    text.split("\n").forEach((line, index) => {
      const match = BACKSLASH_PATH.exec(line);
      if (match) {
        findings.push(
          new Finding(
            `${skill.relPath}/${rel}:${index + 1}`,
            "path-slash",
            `path ${repr(match[0])} uses backslashes; use forward slashes ` +
              `(${repr(match[0].replaceAll("\\", "/"))})`,
          ),
        );
      }
    });
  }
  return findings;
}

export function checkFileNames(skill) {
  const findings = [];
  for (const rel of sorted(skill.files.keys())) {
    const stem = path.posix.parse(basename(rel)).name.toLowerCase();
    if (rel !== "SKILL.md" && GENERIC_FILE_STEM.test(stem)) {
      findings.push(
        new Finding(
          `${skill.relPath}/${rel}`,
          "file-name",
          `${rel} is not named for its content; rename it for the task it serves ` +
            "(`reference/finance.md`, not `doc2.md`)",
          WARNING,
        ),
      );
    }
  }
  return findings;
}

/** Flag dates outside code and outside an 'Old patterns' section. */
export function checkStaleDates(skill) {
  const findings = [];
  for (const [rel, text] of sortedEntries(skill.files)) {
    if (text === null || !rel.endsWith(".md")) continue;
    let oldLevel = null; // heading level of the open 'Old patterns' section
    let inDetails = false;
    stripCode(text)
      .split("\n")
      .forEach((line, index) => {
        const heading = HEADING.exec(line);
        if (heading) {
          const level = heading[1].length;
          if (/old patterns/i.test(heading[2])) oldLevel = level;
          else if (oldLevel !== null && level <= oldLevel) oldLevel = null;
        }
        if (/<summary>.*old patterns/i.test(line)) inDetails = true;
        if (line.includes("</details>")) inDetails = false;
        if (oldLevel !== null || inDetails) return;
        // Quoted text is an example (the rule itself quotes "before August").
        const claim = line.replace(QUOTED, "");
        for (const pattern of STALE_DATE_PATTERNS) {
          const match = pattern.exec(claim);
          if (match) {
            findings.push(
              new Finding(
                `${skill.relPath}/${rel}:${index + 1}`,
                "stale-date",
                `${repr(match[0])} will go stale; describe the current method and ` +
                  "move superseded ones under an 'Old patterns' section",
                WARNING,
              ),
            );
            break;
          }
        }
      });
  }
  return findings;
}

/**
 * Bundled scripts parse, are referenced, and say whether to run or read.
 * `syntaxCheck(rel, text)` returns a problem string, or null when the script
 * parses or cannot be checked; it is a parameter so tests can stub it.
 */
export function checkScripts(skill, syntaxCheck = syntaxProblem) {
  const findings = [];
  const markdown = [...skill.files].filter(([rel, text]) => text && rel.endsWith(".md"));
  for (const [rel, text] of sortedEntries(skill.files)) {
    if (!rel.startsWith("scripts/") || text === null) continue;
    const where = `${skill.relPath}/${rel}`;
    const problem = syntaxCheck(rel, text);
    if (problem) {
      findings.push(new Finding(where, "script-syntax", `${problem}; fix before shipping`));
    }
    const mentions = markdown.flatMap(([, doc]) =>
      doc.split("\n").filter((line) => line.includes(rel) || line.includes(basename(rel))),
    );
    if (!mentions.length) {
      findings.push(
        new Finding(where, "script-referenced", `${rel} is not mentioned in any markdown file`),
      );
    } else if (!mentions.some((line) => RUN_OR_READ.test(line))) {
      findings.push(
        new Finding(
          where,
          "script-run-or-read",
          `say whether to run or read ${rel} ` +
            "('Run `scripts/x.py` to ...' or 'See `scripts/x.py` for ...')",
          WARNING,
        ),
      );
    }
  }
  return findings;
}

export const SKILL_CHECKS = [
  checkFrontmatter,
  checkBodySize,
  checkLinks,
  checkReferenceToc,
  checkPaths,
  checkFileNames,
  checkStaleDates,
  checkScripts,
];

// --------------------------------------------------------------------------
// Evaluation checks (pure)
// --------------------------------------------------------------------------

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * `evals` is the parsed JSON, or null/undefined when the file is missing.
 * `evalTree` is every path under evals/, relative to it.
 * @param {Skill} skill
 * @param {unknown} evals
 * @param {string} evalPath
 * @param {Set<string>} evalTree
 * @param {Set<string>} knownSkills
 */
export function checkEvals(skill, evals, evalPath, evalTree, knownSkills) {
  if (evals === null || evals === undefined) {
    return [
      new Finding(
        evalPath,
        "evals-missing",
        `no evaluations for ${repr(skill.dirName)}; add at least ${MIN_EVALS} scenarios ` +
          "(skills, query, files, expected_behavior)",
      ),
    ];
  }
  if (!Array.isArray(evals)) {
    return [new Finding(evalPath, "evals-format", "top level must be a JSON list of scenarios")];
  }

  const findings = [];
  const own = [];
  evals.forEach((scenario, index) => {
    const where = `${evalPath}#${index + 1}`;
    if (!isObject(scenario)) {
      findings.push(new Finding(where, "evals-format", "a scenario must be a JSON object"));
      return;
    }
    const { skills } = scenario;
    if (!(Array.isArray(skills) && skills.length && skills.every((s) => typeof s === "string"))) {
      findings.push(new Finding(where, "evals-format", "`skills` must be a non-empty list of names"));
    } else {
      for (const name of skills) {
        if (!knownSkills.has(name)) {
          findings.push(
            new Finding(
              where,
              "evals-skill-unknown",
              `\`skills\` names ${repr(name)}; skills are: ${sorted(knownSkills).join(", ")}`,
            ),
          );
        }
      }
      if (skills.includes(skill.dirName)) own.push(scenario);
    }
    if (!isNonEmptyString(scenario.query)) {
      findings.push(new Finding(where, "evals-format", "`query` must be a non-empty string"));
    }
    const behaviors = scenario.expected_behavior;
    if (!(Array.isArray(behaviors) && behaviors.length && behaviors.every(isNonEmptyString))) {
      findings.push(
        new Finding(
          where,
          "evals-format",
          "`expected_behavior` must be a non-empty list of checkable statements",
        ),
      );
    }
    const files = "files" in scenario ? scenario.files : [];
    if (!(Array.isArray(files) && files.every((f) => typeof f === "string"))) {
      findings.push(new Finding(where, "evals-format", "`files` must be a list of paths"));
    } else {
      for (const file of files) {
        if (!evalTree.has(normpath(file))) {
          findings.push(
            new Finding(where, "evals-file-missing", `\`files\` entry ${repr(file)} is not under evals/`),
          );
        }
      }
    }
  });

  if (own.length < MIN_EVALS) {
    findings.push(
      new Finding(
        evalPath,
        "evals-count",
        `${own.length} scenario(s) use ${repr(skill.dirName)}; at least ${MIN_EVALS} are required`,
      ),
    );
  }

  const behaviorText = own
    .filter((scenario) => Array.isArray(scenario.expected_behavior))
    .flatMap((scenario) => scenario.expected_behavior)
    .filter((b) => typeof b === "string")
    .join("\n");
  // Navigation is tested when at least one behavior names a reference file.
  // Requiring every file would force one scenario per file; the rule asks
  // only that evals test which file gets read, not all of them.
  const references = sorted(
    [...linkedFromDirect(skill)].filter(
      (rel) => rel.endsWith(".md") && rel !== "SKILL.md" && skill.files.has(rel),
    ),
  );
  if (references.length && own.length && !references.some((rel) => behaviorText.includes(rel))) {
    findings.push(
      new Finding(
        evalPath,
        "evals-navigation",
        `no expected_behavior names a reference file; add a 'Reads ${references[0]} ` +
          "before ...' behavior so navigation is tested",
      ),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------
// Collection checks (pure)
// --------------------------------------------------------------------------

/**
 * @param {Skill[]} skills
 * @param {Set<string>} evalStems
 */
export function checkCollection(skills, evalStems) {
  if (!skills.length) {
    // Running nothing and reporting success looks like green.
    return [new Finding("skills", "no-skills", "no skill directories found; nothing was checked")];
  }
  const findings = [];
  const names = new Set(skills.map((s) => s.dirName));
  for (const stem of sorted(evalStems)) {
    if (!names.has(stem)) {
      findings.push(
        new Finding(
          `evals/${stem}.json`,
          "evals-orphan",
          `evals/${stem}.json matches no skill; skills are: ${sorted(names).join(", ")}`,
        ),
      );
    }
  }
  const gerund = new Set([...names].filter((n) => n.split("-")[0].endsWith("ing")));
  if (gerund.size && gerund.size !== names.size) {
    for (const name of sorted(names)) {
      if (gerund.has(name)) continue;
      findings.push(
        new Finding(
          `skills/${name}`,
          "name-pattern",
          `${repr(name)} breaks the collection's gerund pattern (${repr(sorted(gerund)[0])}); ` +
            "use one naming pattern across the collection",
          WARNING,
        ),
      );
    }
  }
  return findings;
}

/**
 * Run every check. `evalsByStem` maps a skill name to its parsed eval JSON; a
 * skill without a file is absent from it.
 * @param {Skill[]} skills
 * @param {Map<string, unknown>} evalsByStem
 * @param {Set<string>} evalTree
 */
export function checkAll(skills, evalsByStem, evalTree) {
  const findings = checkCollection(skills, new Set(evalsByStem.keys()));
  const known = new Set(skills.map((s) => s.dirName));
  for (const skill of skills) {
    for (const check of SKILL_CHECKS) findings.push(...check(skill));
    findings.push(
      ...checkEvals(
        skill,
        evalsByStem.get(skill.dirName),
        `evals/${skill.dirName}.json`,
        evalTree,
        known,
      ),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------
// Edges: disk, subprocesses, and command line
// --------------------------------------------------------------------------

/** Every path under `dir`, relative and forward-slashed, with entry kinds. */
function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    const isDir = entry.isDirectory();
    out.push({ rel, isDir });
    if (isDir) out.push(...walk(path.join(dir, entry.name), `${rel}/`));
  }
  return out.sort((a, b) => byCode(a.rel, b.rel));
}

// `fatal` turns invalid UTF-8 into an error (a binary asset); `ignoreBOM` keeps
// a leading BOM so it is not silently accepted before `---`.
const strictUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** Read a skill directory. Unreadable files become findings, not crashes. */
export function loadSkill(skillDir, root) {
  const skill = new Skill(
    path.basename(skillDir),
    path.relative(root, skillDir).split(path.sep).join("/"),
  );
  const findings = [];
  for (const { rel, isDir } of walk(skillDir)) {
    if (isDir || rel.split("/").some((part) => part.startsWith(".") || part === "__pycache__")) {
      continue;
    }
    let bytes;
    try {
      bytes = fs.readFileSync(path.join(skillDir, rel));
    } catch (err) {
      findings.push(
        new Finding(
          `${skill.relPath}/${rel}`,
          "unreadable",
          `cannot read file: ${err.code ?? err.message}; check permissions`,
        ),
      );
      continue;
    }
    try {
      skill.files.set(rel, strictUtf8.decode(bytes));
    } catch {
      skill.files.set(rel, null); // a binary asset, not text
    }
  }
  return { skill, findings };
}

export function loadEvals(evalsDir) {
  const evals = new Map();
  const findings = [];
  const tree = new Set();
  if (!fs.existsSync(evalsDir) || !fs.statSync(evalsDir).isDirectory()) {
    return { evals, tree, findings };
  }
  const entries = walk(evalsDir);
  for (const { rel } of entries) tree.add(rel);
  for (const { rel, isDir } of entries) {
    if (isDir || rel.includes("/") || !rel.endsWith(".json")) continue;
    try {
      evals.set(rel.slice(0, -".json".length), JSON.parse(strictUtf8.decode(fs.readFileSync(path.join(evalsDir, rel)))));
    } catch (err) {
      if (err instanceof SyntaxError) {
        findings.push(new Finding(`evals/${rel}`, "evals-format", `invalid JSON: ${err.message}`));
      } else {
        findings.push(
          new Finding(`evals/${rel}`, "unreadable", `cannot read file: ${err.code ?? err.message}`),
        );
      }
    }
  }
  return { evals, tree, findings };
}

const PY_COMPILE =
  "import sys; compile(open(sys.argv[1], encoding='utf-8').read(), sys.argv[1], 'exec')";

/**
 * Syntax-check a bundled script by asking its own toolchain to parse it:
 * `node --check` for .js/.mjs/.cjs and `python3` for .py. Returns a problem
 * string, or null when it parses, has another extension, or the tool is not
 * installed (a skipped check, not a failure: skills may bundle Python without
 * this repo needing it).
 */
export function syntaxProblem(rel, text) {
  const ext = path.posix.extname(rel);
  let command;
  if ([".js", ".mjs", ".cjs"].includes(ext)) {
    command = (file) => [process.execPath, ["--check", file]];
  } else if (ext === ".py") {
    command = (file) => ["python3", ["-I", "-c", PY_COMPILE, file]];
  } else {
    return null;
  }
  // A temp dir outside the repo, so the interpreter loads no neighbouring files.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-skills-"));
  try {
    const file = path.join(dir, `script${ext}`);
    fs.writeFileSync(file, text);
    const [cmd, args] = command(file);
    const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 10_000 });
    if (result.error || result.status === 0) return null;
    const line = /(?:line |script\.\w+:)(\d+)/.exec(result.stderr)?.[1];
    const message = /^\w*Error: .*$/m.exec(result.stderr)?.[0] ?? "syntax error";
    return line ? `line ${line}: ${message}` : message;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Workflow-command escaping from the GitHub Actions docs.
const githubEscape = (text) => text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");

export function formatFinding(finding, annotate) {
  if (annotate) {
    const level = finding.severity === ERROR ? "error" : "warning";
    const filePart = finding.path.split(":")[0].split("#")[0];
    return `::${level} file=${filePart},title=${finding.rule}::${githubEscape(finding.message)}`;
  }
  const tag = finding.severity === ERROR ? "" : " (warning)";
  return `${finding.path}: [${finding.rule}]${tag} ${finding.message}`;
}

const USAGE = "Usage: node scripts/check_skills.mjs [--root DIR] [--strict]";

/**
 * @param {string[]} argv
 * @param {{log?: (line: string) => void, error?: (line: string) => void, env?: Record<string, string | undefined>}} [io]
 * @returns {number} the process exit code
 */
export function main(argv, { log = console.log, error = console.error, env = process.env } = {}) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        root: { type: "string" },
        strict: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
    }).values;
  } catch (err) {
    error(`error: ${err.message}\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    log(USAGE);
    return 0;
  }

  const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const root = path.resolve(args.root ?? defaultRoot);
  const skillsDir = path.join(root, "skills");
  if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
    error(`error: ${skillsDir} is not a directory; pass --root <repo root>`);
    return 2;
  }

  const findings = [];
  const skills = [];
  const entries = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort(byCode);
  for (const name of entries) {
    const loaded = loadSkill(path.join(skillsDir, name), root);
    skills.push(loaded.skill);
    findings.push(...loaded.findings);
  }
  const loadedEvals = loadEvals(path.join(root, "evals"));
  findings.push(...loadedEvals.findings);
  findings.push(...checkAll(skills, loadedEvals.evals, loadedEvals.tree));

  const annotate = env.GITHUB_ACTIONS === "true";
  findings.sort(
    (a, b) =>
      Number(a.severity !== ERROR) - Number(b.severity !== ERROR) ||
      byCode(a.path, b.path) ||
      byCode(a.rule, b.rule),
  );
  for (const finding of findings) log(formatFinding(finding, annotate));

  const errors = findings.filter((f) => f.severity === ERROR).length;
  const warnings = findings.length - errors;
  if (errors > 0 || (args.strict && warnings > 0)) {
    error(
      `\n${errors} error(s), ${warnings} warning(s) in ${skills.length} skill(s). ` +
        "Reproduce locally: mise run check-skills",
    );
    return 1;
  }
  log(`checked ${skills.length} skill(s): ok` + (warnings ? ` (${warnings} warning(s))` : ""));
  return 0;
}

function isEntryPoint() {
  try {
    return (
      process.argv[1] !== undefined &&
      import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    console.error(`error: Node ${MIN_NODE_MAJOR}+ is required, found ${process.versions.node}`);
    process.exit(2);
  }
  process.exitCode = main(process.argv.slice(2));
}
