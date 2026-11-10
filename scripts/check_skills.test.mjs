/**
 * Tests for check_skills.mjs. Run: node --test scripts/*.test.mjs
 *
 * Each rule has a failing case that must report its rule id, next to a clean
 * baseline (`GOOD`) that must report nothing, so a rule that stops firing or
 * starts over-firing fails here.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import * as cs from "./check_skills.mjs";

const front = (name) =>
  `---\nname: ${name}\ndescription: Extracts text from PDFs. Use when working with PDF files.\n---\n`;
const GOOD = {
  "SKILL.md":
    front("processing-pdfs") +
    "# Processing PDFs\n- Forms → [reference/forms.md](reference/forms.md)\n",
  "reference/forms.md": "# Forms\n\n- Fill fields by name.\n",
};

function makeSkill(files = GOOD, name = "processing-pdfs") {
  return new cs.Skill(name, `skills/${name}`, new Map(Object.entries(files)));
}

/** GOOD plus overrides; a value of null deletes the file. */
function withFiles(changes) {
  const files = { ...GOOD };
  for (const [rel, text] of Object.entries(changes)) {
    if (text === null) delete files[rel];
    else files[rel] = text;
  }
  return files;
}

const withSkillMd = (text) => makeSkill(withFiles({ "SKILL.md": text }));
const rules = (findings) => new Set(findings.map((f) => f.rule));
const ruleAndSeverity = (findings) => findings.map((f) => [f.rule, f.severity]);
const runChecks = (skill) => cs.SKILL_CHECKS.flatMap((check) => check(skill));
const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe("baseline", () => {
  test("a good skill has no findings", () => {
    assert.deepEqual(runChecks(makeSkill()), []);
  });
});

describe("frontmatter", () => {
  const skillWith = (head, name = "processing-pdfs") =>
    makeSkill(withFiles({ "SKILL.md": `${head}# Body\n` }), name);

  test("missing frontmatter", () => {
    assert.deepEqual(rules(cs.checkFrontmatter(skillWith(""))), new Set(["frontmatter"]));
  });

  test("unclosed frontmatter", () => {
    const found = cs.checkFrontmatter(skillWith("---\nname: x\n"));
    assert.match(found[0].message, /not closed/);
  });

  test("a multiline value is reported", () => {
    const found = cs.checkFrontmatter(skillWith("---\nname: a\n  continued\n---\n"));
    assert.deepEqual(rules(found), new Set(["frontmatter"]));
  });

  test("name rules", () => {
    const cases = {
      "Processing-PDFs": "lowercase",
      ["a".repeat(65)]: "65 characters",
      "claude-pdfs": "reserved word 'claude'",
      "anthropic-tools": "reserved word 'anthropic'",
      "pdf-helper": "vague word 'helper'",
      pdf_forms: "lowercase",
    };
    for (const [name, expected] of Object.entries(cases)) {
      const found = cs.checkFrontmatter(skillWith(front(name), name));
      assert.ok(
        found.some((f) => f.message.includes(expected)),
        `${name}: expected ${expected} in ${JSON.stringify(found)}`,
      );
    }
  });

  test("name must match the directory", () => {
    const found = cs.checkFrontmatter(skillWith(front("other-name")));
    assert.deepEqual(rules(found), new Set(["name-dir"]));
  });

  test("description rules", () => {
    const cases = [
      ["", "description"],
      ["x".repeat(1025) + " Use when a.", "description"],
      ["Extracts <b>text</b>. Use when a.", "description"],
      ["I can extract text. Use when a.", "description-person"],
      ["Extracts text for you. Use when a.", "description-person"],
    ];
    for (const [text, rule] of cases) {
      const head = `---\nname: processing-pdfs\ndescription: ${text}\n---\n`;
      const found = cs.checkFrontmatter(skillWith(head));
      assert.ok(rules(found).has(rule), `${text.slice(0, 30)}: expected ${rule}`);
    }
  });

  test("a quoted 'you' is allowed", () => {
    const head =
      "---\nname: processing-pdfs\n" +
      'description: Extracts text. Use when asked "can you read this".\n---\n';
    assert.deepEqual(cs.checkFrontmatter(skillWith(head)), []);
  });

  test("a missing 'Use when' is a warning", () => {
    const head = "---\nname: processing-pdfs\ndescription: Extracts text from PDFs.\n---\n";
    assert.deepEqual(ruleAndSeverity(cs.checkFrontmatter(skillWith(head))), [
      ["description-trigger", cs.WARNING],
    ]);
  });
});

describe("body size", () => {
  const bodyOf = (lines) =>
    cs.checkBodySize(withSkillMd(front("processing-pdfs") + "line\n".repeat(lines)));

  test("thresholds", () => {
    assert.deepEqual(bodyOf(cs.BODY_WARN_LINES - 1), []);
    assert.equal(bodyOf(cs.BODY_WARN_LINES)[0].severity, cs.WARNING);
    assert.equal(bodyOf(cs.BODY_MAX_LINES - 1)[0].severity, cs.WARNING);
    assert.equal(bodyOf(cs.BODY_MAX_LINES)[0].severity, cs.ERROR);
  });
});

describe("links", () => {
  test("a broken link", () => {
    const skill = withSkillMd(GOOD["SKILL.md"] + "- Tables → [t](reference/tables.md)\n");
    const found = cs.checkLinks(skill);
    assert.deepEqual(rules(found), new Set(["link-broken"]));
    assert.match(found[0].message, /reference\/tables\.md/);
  });

  test("a link in code is ignored", () => {
    const text = GOOD["SKILL.md"] + "Example: `[x](missing.md)`\n```\n[y](gone.md)\n```\n";
    assert.deepEqual(cs.checkLinks(withSkillMd(text)), []);
  });

  test("a URL and an anchor are ignored", () => {
    const text = GOOD["SKILL.md"] + "Docs → [a](https://example.com) and [b](#top)\n";
    assert.deepEqual(cs.checkLinks(withSkillMd(text)), []);
  });

  test("a link outside the skill warns", () => {
    const text = GOOD["SKILL.md"] + "Other → [x](../writing-code/SKILL.md)\n";
    assert.deepEqual(ruleAndSeverity(cs.checkLinks(withSkillMd(text))), [
      ["link-outside", cs.WARNING],
    ]);
  });

  test("a file linked from nowhere", () => {
    const found = cs.checkLinks(makeSkill(withFiles({ "reference/extra.md": "# Extra\n" })));
    assert.deepEqual(rules(found), new Set(["file-unlinked"]));
    assert.match(found[0].message, /nowhere/);
  });

  test("a file reachable only through another file", () => {
    const files = withFiles({
      "reference/forms.md": "# Forms\n[more](advanced.md)\n",
      "reference/advanced.md": "# Advanced\n",
    });
    const found = cs.checkLinks(makeSkill(files));
    assert.deepEqual(rules(found), new Set(["file-unlinked"]));
    assert.match(found[0].message, /only from reference\/forms\.md/);
  });

  test("a script named by path counts as linked", () => {
    const text = GOOD["SKILL.md"] + "Run `scripts/check.mjs` to validate.\n";
    const files = withFiles({ "SKILL.md": text, "scripts/check.mjs": "console.log(1);\n" });
    assert.deepEqual(cs.checkLinks(makeSkill(files)), []);
  });

  test("a link without a task warns", () => {
    const text = front("processing-pdfs") + "- See also [forms](reference/forms.md)\n";
    assert.deepEqual(ruleAndSeverity(cs.checkLinks(withSkillMd(text))), [
      ["link-trigger", cs.WARNING],
    ]);
  });

  test("a one-word task is a trigger", () => {
    const text = front("processing-pdfs") + "- Forms → [forms](reference/forms.md)\n";
    assert.deepEqual(cs.checkLinks(withSkillMd(text)), []);
  });

  test("normpath and resolveLocal follow POSIX rules", () => {
    assert.equal(cs.normpath("a/./b//c/../d/"), "a/b/d");
    assert.equal(cs.normpath("../x"), "../x");
    assert.equal(cs.normpath("a/../.."), "..");
    assert.equal(cs.normpath(""), ".");
    assert.equal(cs.resolveLocal("reference/forms.md", "../SKILL.md#top"), "SKILL.md");
    assert.equal(cs.resolveLocal("SKILL.md", "reference/my%20file.md"), "reference/my file.md");
    assert.equal(cs.resolveLocal("SKILL.md", "100%.md"), "100%.md");
    assert.equal(cs.resolveLocal("SKILL.md", "mailto:a@b.c"), null);
    assert.equal(cs.resolveLocal("SKILL.md", "#top"), null);
  });
});

describe("reference table of contents", () => {
  const longFile = (head) => head + "- rule\n".repeat(cs.REFERENCE_TOC_OVER_LINES + 5);
  const check = (head) =>
    cs.checkReferenceToc(makeSkill(withFiles({ "reference/forms.md": longFile(head) })));

  test("a long file without a TOC", () => {
    assert.deepEqual(rules(check("# Forms\n")), new Set(["reference-toc"]));
  });

  test("a contents heading satisfies", () => {
    assert.deepEqual(check("# Forms\n\n## Contents\n- a\n- b\n\n"), []);
  });

  test("an anchor list satisfies", () => {
    assert.deepEqual(check("# Forms\n[a](#a)\n[b](#b)\n[c](#c)\n"), []);
  });

  test("a short file needs none", () => {
    assert.deepEqual(cs.checkReferenceToc(makeSkill()), []);
  });
});

describe("paths and names", () => {
  test("a backslash path", () => {
    const text = GOOD["SKILL.md"] + "Read reference\\forms.md first.\n";
    const found = cs.checkPaths(withSkillMd(text));
    assert.deepEqual(rules(found), new Set(["path-slash"]));
    assert.match(found[0].message, /reference\/forms\.md/);
  });

  test("a generic file name", () => {
    const found = cs.checkFileNames(makeSkill(withFiles({ "reference/doc2.md": "# x\n" })));
    assert.deepEqual(rules(found), new Set(["file-name"]));
  });
});

describe("stale dates", () => {
  const check = (line) => cs.checkStaleDates(withSkillMd(`${GOOD["SKILL.md"]}${line}\n`));

  test("flagged", () => {
    for (const line of [
      "Before August, use the old API.",
      "Updated 2025-03-04.",
      "Released March 2025.",
      "Planned for Q3 2026.",
      "As of Jan 5, 2026 this changed.",
    ]) {
      assert.deepEqual(rules(check(line)), new Set(["stale-date"]), line);
    }
  });

  test("not flagged", () => {
    for (const line of [
      "Use the current method.",
      'Never write "before August, use the old API".',
      "Run `date 2025-03-04` to see it.",
      "May the best option win.",
    ]) {
      assert.deepEqual(check(line), [], line);
    }
  });

  test("an 'Old patterns' section is exempt until the next heading", () => {
    const text =
      GOOD["SKILL.md"] +
      "## Old patterns\nBefore August use v1.\n## Next\nBefore August use v2.\n";
    const found = cs.checkStaleDates(withSkillMd(text));
    const expectedLine = text.slice(0, text.indexOf("v2")).split("\n").length;
    assert.deepEqual(
      found.map((f) => f.path.split(":").pop()),
      [String(expectedLine)],
    );
  });

  test("a details block is exempt", () => {
    const text =
      GOOD["SKILL.md"] +
      "<details><summary>Old patterns</summary>\nBefore August use v1.\n</details>\n";
    assert.deepEqual(cs.checkStaleDates(withSkillMd(text)), []);
  });
});

describe("bundled scripts", () => {
  const skillWith = (file, script, mention) =>
    makeSkill(withFiles({ "SKILL.md": GOOD["SKILL.md"] + mention, [file]: script }));

  test("a clean script", () => {
    const skill = skillWith("scripts/check.mjs", "console.log(1);\n", "Run `scripts/check.mjs` to validate.\n");
    assert.deepEqual(cs.checkScripts(skill), []);
  });

  test("a JavaScript syntax error", () => {
    const skill = skillWith("scripts/check.mjs", "const = ;\n", "Run `scripts/check.mjs`.\n");
    const found = cs.checkScripts(skill);
    assert.deepEqual(rules(found), new Set(["script-syntax"]));
    assert.match(found[0].message, /^line 1: SyntaxError/);
  });

  test("a Python syntax error", { skip: !hasPython && "python3 is not installed" }, () => {
    const skill = skillWith("scripts/check.py", "def (:\n", "Run `scripts/check.py`.\n");
    assert.deepEqual(rules(cs.checkScripts(skill)), new Set(["script-syntax"]));
  });

  test("a script type with no toolchain is not checked", () => {
    const skill = skillWith("scripts/check.sh", "if then\n", "Run `scripts/check.sh`.\n");
    assert.deepEqual(cs.checkScripts(skill), []);
  });

  test("an unreferenced script", () => {
    const skill = makeSkill(withFiles({ "scripts/check.mjs": "console.log(1);\n" }));
    assert.deepEqual(rules(cs.checkScripts(skill)), new Set(["script-referenced"]));
  });

  test("a missing run-or-read warns", () => {
    const skill = skillWith("scripts/check.mjs", "console.log(1);\n", "The `scripts/check.mjs` file exists.\n");
    assert.deepEqual(ruleAndSeverity(cs.checkScripts(skill)), [["script-run-or-read", cs.WARNING]]);
  });

  test("the syntax check is injectable", () => {
    const skill = skillWith("scripts/check.mjs", "x", "Run `scripts/check.mjs`.\n");
    const found = cs.checkScripts(skill, () => "line 3: boom");
    assert.equal(found[0].message, "line 3: boom; fix before shipping");
  });
});

const scenario = (changes = {}) => ({
  skills: ["processing-pdfs"],
  query: "Fill this form.",
  files: [],
  expected_behavior: ["Reads reference/forms.md before filling"],
  ...changes,
});
const times = (n, item) => Array.from({ length: n }, () => item);

describe("evals", () => {
  const TREE = new Set(["fixtures", "fixtures/form"]);
  const KNOWN = new Set(["processing-pdfs"]);
  const check = (evals, skill = makeSkill()) =>
    cs.checkEvals(skill, evals, "evals/processing-pdfs.json", TREE, KNOWN);

  test("good", () => {
    assert.deepEqual(check(times(3, scenario())), []);
  });

  test("a missing file", () => {
    assert.deepEqual(rules(check(undefined)), new Set(["evals-missing"]));
    assert.deepEqual(rules(check(null)), new Set(["evals-missing"]));
  });

  test("a top level that is not a list", () => {
    assert.deepEqual(rules(check({})), new Set(["evals-format"]));
  });

  test("too few scenarios", () => {
    assert.deepEqual(rules(check(times(2, scenario()))), new Set(["evals-count"]));
  });

  test("scenarios for other skills do not count", () => {
    const found = check([...times(2, scenario()), scenario({ skills: ["other"] })]);
    assert.deepEqual(rules(found), new Set(["evals-count", "evals-skill-unknown"]));
  });

  test("field formats", () => {
    for (const change of [
      { query: "" },
      { expected_behavior: [] },
      { expected_behavior: [""] },
      { skills: [] },
      { files: "fixtures" },
    ]) {
      const found = check(times(3, scenario(change)));
      assert.ok(rules(found).has("evals-format"), JSON.stringify(change));
    }
  });

  test("a non-object scenario", () => {
    const found = check([...times(3, scenario()), "text"]);
    assert.deepEqual(rules(found), new Set(["evals-format"]));
  });

  test("an unknown skill name lists the valid ones", () => {
    const found = check([...times(3, scenario()), scenario({ skills: ["nope"] })]);
    const message = found.find((f) => f.rule === "evals-skill-unknown").message;
    assert.match(message, /'nope'/);
    assert.match(message, /processing-pdfs/);
  });

  test("a missing fixture", () => {
    const found = check(times(3, scenario({ files: ["fixtures/gone"] })));
    assert.deepEqual(rules(found), new Set(["evals-file-missing"]));
  });

  test("an existing fixture directory", () => {
    assert.deepEqual(check(times(3, scenario({ files: ["fixtures/form"] }))), []);
  });

  test("navigation untested", () => {
    const found = check(times(3, scenario({ expected_behavior: ["Fills the form"] })));
    assert.deepEqual(rules(found), new Set(["evals-navigation"]));
  });

  test("a skill without references needs no navigation", () => {
    const skill = makeSkill({ "SKILL.md": front("processing-pdfs") + "# Body\n" });
    const found = check(times(3, scenario({ expected_behavior: ["Fills the form"] })), skill);
    assert.deepEqual(found, []);
  });
});

describe("collection", () => {
  test("no skills is an error", () => {
    assert.deepEqual(rules(cs.checkCollection([], new Set())), new Set(["no-skills"]));
  });

  test("an orphan eval", () => {
    const found = cs.checkCollection([makeSkill()], new Set(["processing-pdfs", "ghost"]));
    assert.deepEqual(rules(found), new Set(["evals-orphan"]));
  });

  test("a mixed name pattern", () => {
    const skills = [makeSkill(GOOD, "processing-pdfs"), makeSkill(GOOD, "pdf-processing")];
    const found = cs.checkCollection(skills, new Set());
    assert.deepEqual(
      found.map((f) => [f.rule, f.path]),
      [["name-pattern", "skills/pdf-processing"]],
    );
  });
});

describe("main (end to end on a temp repo)", () => {
  function build({ skillFiles = GOOD, evals = times(3, scenario()) } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-skills-test-"));
    for (const [rel, text] of Object.entries(skillFiles)) {
      const file = path.join(root, "skills", "processing-pdfs", rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    fs.mkdirSync(path.join(root, "evals"));
    fs.writeFileSync(path.join(root, "evals", "processing-pdfs.json"), JSON.stringify(evals));
    return root;
  }

  /** Run main() in a temp repo and return the exit code and what it printed. */
  function run(setup, ...args) {
    const root = setup instanceof Function ? setup() : setup;
    try {
      const out = [];
      const err = [];
      const code = cs.main(["--root", root, ...args], {
        log: (line) => out.push(line),
        error: (line) => err.push(line),
        env: {},
      });
      return { code, out, err, root };
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  test("a clean repo passes", () => {
    const { code, out } = run(build(), "--strict");
    assert.equal(code, 0);
    assert.deepEqual(out, ["checked 1 skill(s): ok"]);
  });

  test("an error fails", () => {
    const { code, err } = run(build({ evals: [scenario()] }));
    assert.equal(code, 1);
    assert.match(err.join("\n"), /Reproduce locally: mise run check-skills/);
  });

  test("a warning fails only under --strict", () => {
    const skillFiles = withFiles({ "SKILL.md": GOOD["SKILL.md"] + "Before August use v1.\n" });
    assert.equal(run(build({ skillFiles })).code, 0);
    assert.equal(run(build({ skillFiles }), "--strict").code, 1);
  });

  test("invalid eval JSON is a finding, not a crash", () => {
    const root = build();
    fs.writeFileSync(path.join(root, "evals", "processing-pdfs.json"), "{nope");
    const { code, out } = run(root);
    assert.equal(code, 1);
    assert.match(out.join("\n"), /\[evals-format\] invalid JSON/);
  });

  test("a binary asset is not a crash", () => {
    const root = build();
    fs.writeFileSync(
      path.join(root, "skills", "processing-pdfs", "reference", "logo.png"),
      Buffer.from([0xff, 0xfe, 0x00]),
    );
    // The asset is unlinked, so the run fails on that rule, not on a decode error.
    const { code, out } = run(root);
    assert.equal(code, 1);
    assert.match(out.join("\n"), /\[file-unlinked\]/);
  });

  test("a missing skills directory is a usage error", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-skills-test-"));
    assert.equal(run(root).code, 2);
  });

  test("an empty skills directory is not green", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-skills-test-"));
    fs.mkdirSync(path.join(root, "skills"));
    assert.equal(run(root).code, 1);
  });

  test("an unknown option is a usage error", () => {
    const err = [];
    assert.equal(cs.main(["--bogus"], { error: (line) => err.push(line) }), 2);
    assert.match(err[0], /Unknown option/);
  });

  test("a hidden directory under skills/ is not a skill", () => {
    const root = build();
    fs.mkdirSync(path.join(root, "skills", ".cache"));
    assert.equal(run(root, "--strict").code, 0);
  });
});

describe("format", () => {
  test("plain", () => {
    const f = new cs.Finding("skills/x/SKILL.md:3", "link-broken", "bad link");
    assert.equal(cs.formatFinding(f, false), "skills/x/SKILL.md:3: [link-broken] bad link");
  });

  test("a warning is tagged", () => {
    const f = new cs.Finding("skills/x/SKILL.md", "stale-date", "old", cs.WARNING);
    assert.equal(cs.formatFinding(f, false), "skills/x/SKILL.md: [stale-date] (warning) old");
  });

  test("a GitHub annotation escapes newlines", () => {
    const f = new cs.Finding("evals/x.json#2", "evals-format", "a\nb", cs.WARNING);
    assert.equal(
      cs.formatFinding(f, true),
      "::warning file=evals/x.json,title=evals-format::a%0Ab",
    );
  });
});
