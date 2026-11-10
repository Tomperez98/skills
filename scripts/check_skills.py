#!/usr/bin/env python3
"""Check every skill under skills/ against the rules in skills/writing-skills.

Run:  python3 scripts/check_skills.py [--root DIR] [--strict]
      (or `mise run check-skills`, which is what CI calls)

Prints one line per finding, `path: [rule] message`, and exits 0 when clean,
1 when there are errors (or warnings under --strict), 2 on bad usage.

Only the standard library is used, so a stock runner needs no setup. Judgment
rules (does each token earn its place, one term per concept, are examples
concrete) are not checkable here; the evals cover them.

Layout: parsing and checks are pure functions of text; `load_*` and `main` are
the only code that touches the disk.
"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote

# 3.9: macOS ships 3.9 as `python3`, and ubuntu-24.04 runners ship 3.12. The
# script avoids anything newer so both run it with no install step.
MIN_PYTHON = (3, 9)

# Limits quoted from skills/writing-skills/SKILL.md.
NAME_MAX = 64
DESCRIPTION_MAX = 1024
BODY_MAX_LINES = 500
# 80% of the limit: the rule says to split before reaching 500, so warn early.
BODY_WARN_LINES = 400
REFERENCE_TOC_OVER_LINES = 100
# 30: a partial read such as `head -100` must still show the table of contents.
TOC_WINDOW_LINES = 30
# 3 anchor links in the window is the smallest list that reads as a TOC.
TOC_MIN_ANCHORS = 3
# 3 is the minimum number of evaluations the rule asks for.
MIN_EVALS = 3
# One task word is enough ("README → [..]"); filler alone ("See also") is not.
MIN_TRIGGER_WORDS = 1
FILLER_WORDS = frozenset(
    {"see", "also", "read", "link", "refer", "more", "details", "info", "docs", "here"}
)

RESERVED_NAME_WORDS = ("anthropic", "claude")
# Names the rule calls vague. Compared per hyphen-separated word.
VAGUE_NAME_WORDS = ("helper", "helpers", "utils", "util", "files", "tools", "misc")
GENERIC_FILE_STEM = re.compile(
    r"^(doc|file|ref|reference|notes|misc|other|temp|tmp)\d*$"
)

ERROR = "error"
WARNING = "warning"

MONTHS = (
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    "|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)
STALE_DATE_PATTERNS = (
    re.compile(r"\b(?:19|20)\d{2}-\d{2}-\d{2}\b"),
    re.compile(rf"\b(?:{MONTHS})\.?\s+(?:\d{{1,2}},?\s+)?(?:19|20)\d{{2}}\b", re.I),
    re.compile(
        rf"\b(?:before|after|until|since|as of|starting|beginning)\s+(?:{MONTHS})\b",
        re.I,
    ),
    re.compile(r"\bQ[1-4]\s+(?:19|20)\d{2}\b"),
)
XML_TAG = re.compile(r"</?[A-Za-z][^>]*>")
LINK = re.compile(r"\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
BACKSLASH_PATH = re.compile(
    r"[\w.-]+(?:\\[\w.-]+)+\.(?:md|py|sh|json|txt|js|ts|yml|yaml)\b"
)
SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:", re.I)
FIRST_PERSON = re.compile(r"\b(?:I|I'm|I'll|I've|me|my|we|our)\b")
SECOND_PERSON = re.compile(r"\b(?:you|your|yours)\b", re.I)
QUOTED = re.compile(r"\"[^\"]*\"|“[^”]*”")
RUN_OR_READ = re.compile(r"\b(?:run|runs|running|execute|read|see|view)\b", re.I)


@dataclass(frozen=True)
class Finding:
    path: str  # repo-relative, forward slashes
    rule: str
    message: str
    severity: str = ERROR


@dataclass
class Skill:
    """A skill directory. `files` maps a path relative to the skill directory
    (forward slashes) to its text, or None for a non-text file."""

    dir_name: str
    rel_path: str  # e.g. "skills/writing-code"
    files: dict[str, Optional[str]] = field(default_factory=dict)

    @property
    def skill_md(self) -> Optional[str]:
        return self.files.get("SKILL.md")


@dataclass
class Frontmatter:
    fields: dict[str, str]
    body: str


# --------------------------------------------------------------------------
# Parsing helpers (pure)
# --------------------------------------------------------------------------


def parse_frontmatter(text: str) -> tuple[Optional[Frontmatter], Optional[str]]:
    """Return (frontmatter, None) or (None, problem). Only single-line
    `key: value` pairs are supported, which is all the skill format needs."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None, "SKILL.md must start with a `---` frontmatter line"
    for end in range(1, len(lines)):
        if lines[end].strip() == "---":
            break
    else:
        return None, "frontmatter is not closed: add a closing `---` line"
    fields: dict[str, str] = {}
    for number, line in enumerate(lines[1:end], start=2):
        if not line.strip():
            continue
        key, sep, value = line.partition(":")
        if not sep or not key.strip() or key != key.strip():
            return None, (
                f"frontmatter line {number} is not a single-line `key: value` pair: {line!r}"
            )
        fields[key.strip()] = value.strip().strip("\"'")
    return Frontmatter(fields, "\n".join(lines[end + 1 :])), None


def strip_code(text: str) -> str:
    """Blank fenced blocks and inline code spans, keeping line numbers, so
    examples are not mistaken for claims or links."""
    out: list[str] = []
    fence: Optional[str] = None
    for line in text.split("\n"):
        marker = line.lstrip()[:3]
        if fence is None and marker in ("```", "~~~"):
            fence = marker
            out.append("")
        elif fence is not None:
            if marker == fence:
                fence = None
            out.append("")
        else:
            out.append(re.sub(r"`[^`\n]*`", lambda m: " " * len(m.group(0)), line))
    return "\n".join(out)


def extract_links(text: str) -> list[tuple[int, str, str]]:
    """(line number, link text, target) for each Markdown link outside code."""
    found = []
    for number, line in enumerate(strip_code(text).split("\n"), start=1):
        for match in LINK.finditer(line):
            found.append((number, match.group(1), match.group(2)))
    return found


def resolve_local(source: str, target: str) -> Optional[str]:
    """Resolve a link target against the file holding it. Returns a normalized
    path relative to the skill directory ('..' prefixes kept), or None for URLs
    and same-page anchors."""
    target = unquote(target).split("#", 1)[0].split("?", 1)[0]
    if not target or SCHEME.match(target):
        return None
    return posixpath.normpath(posixpath.join(posixpath.dirname(source), target))


def is_text_md(skill: Skill, rel: str) -> bool:
    return rel.endswith(".md") and skill.files.get(rel) is not None


# --------------------------------------------------------------------------
# Per-skill checks (pure): Skill -> list[Finding]
# --------------------------------------------------------------------------


def check_frontmatter(skill: Skill) -> list[Finding]:
    path = f"{skill.rel_path}/SKILL.md"
    if skill.skill_md is None:
        return [
            Finding(
                path, "skill-md-missing", "SKILL.md is missing; every skill needs one"
            )
        ]
    front, problem = parse_frontmatter(skill.skill_md)
    if front is None:
        return [Finding(path, "frontmatter", str(problem))]

    findings: list[Finding] = []
    name = front.fields.get("name", "")
    if not name:
        findings.append(Finding(path, "name", "`name` is missing or empty"))
    else:
        if len(name) > NAME_MAX:
            findings.append(
                Finding(
                    path,
                    "name",
                    f"`name` is {len(name)} characters, the limit is {NAME_MAX}",
                )
            )
        if not re.fullmatch(r"[a-z0-9-]+", name):
            findings.append(
                Finding(
                    path,
                    "name",
                    f"`name` {name!r} must use only lowercase letters, digits, and hyphens",
                )
            )
        for word in RESERVED_NAME_WORDS:
            if word in name:
                findings.append(
                    Finding(
                        path,
                        "name",
                        f"`name` {name!r} contains the reserved word {word!r}",
                    )
                )
        if XML_TAG.search(name):
            findings.append(
                Finding(path, "name", f"`name` {name!r} must not contain XML tags")
            )
        vague = [w for w in name.split("-") if w in VAGUE_NAME_WORDS]
        if vague:
            findings.append(
                Finding(
                    path,
                    "name-vague",
                    f"`name` {name!r} contains the vague word {vague[0]!r}; "
                    "name the activity, e.g. `processing-pdfs`",
                )
            )
        if name != skill.dir_name:
            findings.append(
                Finding(
                    path,
                    "name-dir",
                    f"`name` {name!r} must equal its directory name {skill.dir_name!r}",
                )
            )

    description = front.fields.get("description", "")
    if not description:
        findings.append(
            Finding(path, "description", "`description` is missing or empty")
        )
    else:
        if len(description) > DESCRIPTION_MAX:
            findings.append(
                Finding(
                    path,
                    "description",
                    f"`description` is {len(description)} characters, the limit is {DESCRIPTION_MAX}",
                )
            )
        if XML_TAG.search(description):
            findings.append(
                Finding(path, "description", "`description` must not contain XML tags")
            )
        unquoted = QUOTED.sub("", description)
        person = FIRST_PERSON.search(unquoted) or SECOND_PERSON.search(unquoted)
        if person:
            findings.append(
                Finding(
                    path,
                    "description-person",
                    f"`description` uses {person.group(0)!r}; write it in third person "
                    '("Extracts text from PDFs")',
                )
            )
        if not re.search(r"\buse when\b", description, re.I):
            findings.append(
                Finding(
                    path,
                    "description-trigger",
                    "`description` has no 'Use when ...' clause naming the triggers",
                    WARNING,
                )
            )
    return findings


def check_body_size(skill: Skill) -> list[Finding]:
    if skill.skill_md is None:
        return []
    front, _ = parse_frontmatter(skill.skill_md)
    body = front.body if front else skill.skill_md
    lines = len(body.rstrip("\n").split("\n"))
    path = f"{skill.rel_path}/SKILL.md"
    if lines >= BODY_MAX_LINES:
        return [
            Finding(
                path,
                "body-size",
                f"body is {lines} lines, the limit is under {BODY_MAX_LINES}; "
                "move area-specific rules into reference files",
            )
        ]
    if lines >= BODY_WARN_LINES:
        return [
            Finding(
                path,
                "body-size",
                f"body is {lines} lines; split before reaching {BODY_MAX_LINES}",
                WARNING,
            )
        ]
    return []


def check_links(skill: Skill) -> list[Finding]:
    """Broken links, links leaving the skill, files not linked from SKILL.md,
    and links without a trigger."""
    findings: list[Finding] = []
    linked_from: dict[str, set[str]] = {}  # target -> files linking it
    for rel, text in sorted(skill.files.items()):
        if text is None or not rel.endswith(".md"):
            continue
        for number, _label, target in extract_links(text):
            resolved = resolve_local(rel, target)
            where = f"{skill.rel_path}/{rel}:{number}"
            if resolved is None:
                continue
            if resolved == ".." or resolved.startswith("../"):
                findings.append(
                    Finding(
                        where,
                        "link-outside",
                        f"link {target!r} leaves the skill directory; skills install "
                        "one by one, so copy the text in or link within the skill",
                        WARNING,
                    )
                )
                continue
            is_dir = any(f.startswith(resolved + "/") for f in skill.files)
            if resolved not in skill.files and not is_dir:
                findings.append(
                    Finding(
                        where,
                        "link-broken",
                        f"link {target!r} points at no file in the skill",
                    )
                )
                continue
            linked_from.setdefault(resolved, set()).add(rel)

    skill_md = skill.skill_md or ""
    direct = linked_from_direct(skill)
    for rel in sorted(skill.files):
        if rel == "SKILL.md" or rel in direct:
            continue
        if not rel.endswith(".md") and rel in skill_md:
            continue  # a script or asset named by path in SKILL.md counts as referenced
        others = sorted(linked_from.get(rel, set()) - {"SKILL.md"})
        if others:
            reason = f"is linked only from {others[0]}; link it directly from SKILL.md"
        else:
            reason = "is linked from nowhere; link it from SKILL.md with the task that needs it"
        findings.append(
            Finding(f"{skill.rel_path}/{rel}", "file-unlinked", f"{rel} {reason}")
        )

    for number, label, target in extract_links(skill_md):
        resolved = resolve_local("SKILL.md", target)
        if resolved is None or resolved not in skill.files:
            continue
        line = skill_md.split("\n")[number - 1]
        without_link = LINK.sub(" ", line)
        words = [
            w
            for w in re.findall(r"[A-Za-z]{2,}", without_link)
            if w.lower() not in FILLER_WORDS
        ]
        if len(words) < MIN_TRIGGER_WORDS:
            findings.append(
                Finding(
                    f"{skill.rel_path}/SKILL.md:{number}",
                    "link-trigger",
                    f"link to {target!r} names no task; write 'Task → [file](file)' "
                    "so the model knows when to read it",
                    WARNING,
                )
            )
    return findings


def linked_from_direct(skill: Skill) -> set[str]:
    direct: set[str] = set()
    for _number, _label, target in extract_links(skill.skill_md or ""):
        resolved = resolve_local("SKILL.md", target)
        if resolved is not None:
            direct.add(resolved)
    return direct


def check_reference_toc(skill: Skill) -> list[Finding]:
    findings = []
    for rel, text in sorted(skill.files.items()):
        if text is None or not rel.endswith(".md") or rel == "SKILL.md":
            continue
        lines = text.split("\n")
        if len(lines) <= REFERENCE_TOC_OVER_LINES:
            continue
        window = "\n".join(lines[:TOC_WINDOW_LINES])
        anchors = len(re.findall(r"\]\(#", window))
        has_heading = re.search(
            r"^#{1,6}\s+(?:table of )?contents\b", window, re.I | re.M
        )
        if not has_heading and anchors < TOC_MIN_ANCHORS:
            findings.append(
                Finding(
                    f"{skill.rel_path}/{rel}",
                    "reference-toc",
                    f"{rel} is {len(lines)} lines (over {REFERENCE_TOC_OVER_LINES}) with no "
                    f"table of contents in its first {TOC_WINDOW_LINES} lines",
                )
            )
    return findings


def check_paths(skill: Skill) -> list[Finding]:
    findings = []
    for rel, text in sorted(skill.files.items()):
        if text is None or not rel.endswith(".md"):
            continue
        for number, line in enumerate(text.split("\n"), start=1):
            match = BACKSLASH_PATH.search(line)
            if match:
                findings.append(
                    Finding(
                        f"{skill.rel_path}/{rel}:{number}",
                        "path-slash",
                        f"path {match.group(0)!r} uses backslashes; use forward slashes "
                        f"({match.group(0).replace(chr(92), '/')!r})",
                    )
                )
    return findings


def check_file_names(skill: Skill) -> list[Finding]:
    findings = []
    for rel in sorted(skill.files):
        stem = posixpath.splitext(posixpath.basename(rel))[0].lower()
        if rel != "SKILL.md" and GENERIC_FILE_STEM.match(stem):
            findings.append(
                Finding(
                    f"{skill.rel_path}/{rel}",
                    "file-name",
                    f"{rel} is not named for its content; rename it for the task it serves "
                    "(`reference/finance.md`, not `doc2.md`)",
                    WARNING,
                )
            )
    return findings


def check_stale_dates(skill: Skill) -> list[Finding]:
    """Flag dates outside code and outside an 'Old patterns' section."""
    findings = []
    for rel, text in sorted(skill.files.items()):
        if text is None or not rel.endswith(".md"):
            continue
        old_level: Optional[int] = (
            None  # heading level of the open 'Old patterns' section
        )
        in_details = False
        for number, line in enumerate(strip_code(text).split("\n"), start=1):
            heading = HEADING.match(line)
            if heading:
                level = len(heading.group(1))
                if re.search(r"old patterns", heading.group(2), re.I):
                    old_level = level
                elif old_level is not None and level <= old_level:
                    old_level = None
            if re.search(r"<summary>.*old patterns", line, re.I):
                in_details = True
            if "</details>" in line:
                in_details = False
            if old_level is not None or in_details:
                continue
            # Quoted text is an example (the rule itself quotes "before August").
            claim = QUOTED.sub("", line)
            for pattern in STALE_DATE_PATTERNS:
                match = pattern.search(claim)
                if match:
                    findings.append(
                        Finding(
                            f"{skill.rel_path}/{rel}:{number}",
                            "stale-date",
                            f"{match.group(0)!r} will go stale; describe the current method and "
                            "move superseded ones under an 'Old patterns' section",
                            WARNING,
                        )
                    )
                    break
    return findings


def check_scripts(skill: Skill) -> list[Finding]:
    """Bundled scripts parse, are referenced, and say whether to run or read."""
    findings = []
    markdown = {
        rel: text for rel, text in skill.files.items() if text and rel.endswith(".md")
    }
    for rel, text in sorted(skill.files.items()):
        if not rel.startswith("scripts/") or text is None:
            continue
        where = f"{skill.rel_path}/{rel}"
        if rel.endswith(".py"):
            try:
                compile(text, rel, "exec")
            except SyntaxError as err:
                findings.append(
                    Finding(
                        where,
                        "script-syntax",
                        f"line {err.lineno}: {err.msg}; fix before shipping",
                    )
                )
        mentions = [
            line
            for doc in markdown.values()
            for line in doc.split("\n")
            if rel in line or posixpath.basename(rel) in line
        ]
        if not mentions:
            findings.append(
                Finding(
                    where,
                    "script-referenced",
                    f"{rel} is not mentioned in any markdown file",
                )
            )
        elif not any(RUN_OR_READ.search(line) for line in mentions):
            findings.append(
                Finding(
                    where,
                    "script-run-or-read",
                    f"say whether to run or read {rel} "
                    "('Run `scripts/x.py` to ...' or 'See `scripts/x.py` for ...')",
                    WARNING,
                )
            )
    return findings


SKILL_CHECKS: list[Callable[[Skill], list[Finding]]] = [
    check_frontmatter,
    check_body_size,
    check_links,
    check_reference_toc,
    check_paths,
    check_file_names,
    check_stale_dates,
    check_scripts,
]


# --------------------------------------------------------------------------
# Evaluation checks (pure)
# --------------------------------------------------------------------------


def check_evals(
    skill: Skill,
    evals: object,
    eval_path: str,
    eval_tree: frozenset[str],
    known_skills: frozenset[str],
) -> list[Finding]:
    """`evals` is the parsed JSON, or None when the file is missing.
    `eval_tree` is every path under evals/, relative to it."""
    if evals is None:
        return [
            Finding(
                eval_path,
                "evals-missing",
                f"no evaluations for {skill.dir_name!r}; add at least {MIN_EVALS} scenarios "
                "(skills, query, files, expected_behavior)",
            )
        ]
    if not isinstance(evals, list):
        return [
            Finding(
                eval_path, "evals-format", "top level must be a JSON list of scenarios"
            )
        ]

    findings: list[Finding] = []
    own: list[dict] = []
    for index, scenario in enumerate(evals, start=1):
        where = f"{eval_path}#{index}"
        if not isinstance(scenario, dict):
            findings.append(
                Finding(where, "evals-format", "a scenario must be a JSON object")
            )
            continue
        skills = scenario.get("skills")
        if not (
            isinstance(skills, list)
            and skills
            and all(isinstance(s, str) for s in skills)
        ):
            findings.append(
                Finding(
                    where, "evals-format", "`skills` must be a non-empty list of names"
                )
            )
        else:
            for name in skills:
                if name not in known_skills:
                    findings.append(
                        Finding(
                            where,
                            "evals-skill-unknown",
                            f"`skills` names {name!r}; skills are: {', '.join(sorted(known_skills))}",
                        )
                    )
            if skill.dir_name in skills:
                own.append(scenario)
        query = scenario.get("query")
        if not (isinstance(query, str) and query.strip()):
            findings.append(
                Finding(where, "evals-format", "`query` must be a non-empty string")
            )
        behaviors = scenario.get("expected_behavior")
        if not (
            isinstance(behaviors, list)
            and behaviors
            and all(isinstance(b, str) and b.strip() for b in behaviors)
        ):
            findings.append(
                Finding(
                    where,
                    "evals-format",
                    "`expected_behavior` must be a non-empty list of checkable statements",
                )
            )
        files = scenario.get("files", [])
        if not (isinstance(files, list) and all(isinstance(f, str) for f in files)):
            findings.append(
                Finding(where, "evals-format", "`files` must be a list of paths")
            )
        else:
            for path in files:
                if posixpath.normpath(path) not in eval_tree:
                    findings.append(
                        Finding(
                            where,
                            "evals-file-missing",
                            f"`files` entry {path!r} is not under evals/",
                        )
                    )

    if len(own) < MIN_EVALS:
        findings.append(
            Finding(
                eval_path,
                "evals-count",
                f"{len(own)} scenario(s) use {skill.dir_name!r}; at least {MIN_EVALS} are required",
            )
        )

    behavior_text = "\n".join(
        b
        for scenario in own
        if isinstance(scenario.get("expected_behavior"), list)
        for b in scenario["expected_behavior"]
        if isinstance(b, str)
    )
    # Navigation is tested when at least one behavior names a reference file.
    # Requiring every file would force one scenario per file; the rule asks
    # only that evals test which file gets read, not all of them.
    references = sorted(
        rel
        for rel in linked_from_direct(skill)
        if rel.endswith(".md") and rel != "SKILL.md" and rel in skill.files
    )
    if references and own and not any(rel in behavior_text for rel in references):
        findings.append(
            Finding(
                eval_path,
                "evals-navigation",
                f"no expected_behavior names a reference file; add a 'Reads {references[0]} "
                "before ...' behavior so navigation is tested",
            )
        )
    return findings


# --------------------------------------------------------------------------
# Collection checks (pure)
# --------------------------------------------------------------------------


def check_collection(skills: list[Skill], eval_stems: frozenset[str]) -> list[Finding]:
    findings: list[Finding] = []
    if not skills:
        # Running nothing and reporting success looks like green.
        return [
            Finding(
                "skills", "no-skills", "no skill directories found; nothing was checked"
            )
        ]
    names = {s.dir_name for s in skills}
    for stem in sorted(eval_stems - names):
        findings.append(
            Finding(
                f"evals/{stem}.json",
                "evals-orphan",
                f"evals/{stem}.json matches no skill; skills are: {', '.join(sorted(names))}",
            )
        )
    gerund = {s.dir_name for s in skills if s.dir_name.split("-")[0].endswith("ing")}
    if gerund and gerund != names:
        for name in sorted(names - gerund):
            findings.append(
                Finding(
                    f"skills/{name}",
                    "name-pattern",
                    f"{name!r} breaks the collection's gerund pattern ({sorted(gerund)[0]!r}); "
                    "use one naming pattern across the collection",
                    WARNING,
                )
            )
    return findings


def check_all(
    skills: list[Skill],
    evals_by_stem: dict[str, object],
    eval_tree: frozenset[str],
) -> list[Finding]:
    """Run every check. `evals_by_stem` maps a skill name to its parsed eval
    JSON; a skill without a file is absent from it."""
    findings = check_collection(skills, frozenset(evals_by_stem))
    known = frozenset(s.dir_name for s in skills)
    for skill in skills:
        for check in SKILL_CHECKS:
            findings.extend(check(skill))
        findings.extend(
            check_evals(
                skill,
                evals_by_stem.get(skill.dir_name),
                f"evals/{skill.dir_name}.json",
                eval_tree,
                known,
            )
        )
    return findings


# --------------------------------------------------------------------------
# Edges: disk and command line
# --------------------------------------------------------------------------


def load_skill(skill_dir: Path, root: Path) -> tuple[Skill, list[Finding]]:
    """Read a skill directory. Unreadable files become findings, not crashes."""
    skill = Skill(skill_dir.name, skill_dir.relative_to(root).as_posix())
    findings: list[Finding] = []
    for path in sorted(skill_dir.rglob("*")):
        rel = path.relative_to(skill_dir).as_posix()
        if path.is_dir() or any(
            part.startswith(".") or part == "__pycache__" for part in rel.split("/")
        ):
            continue
        try:
            skill.files[rel] = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            skill.files[rel] = None  # a binary asset, not text
        except OSError as err:
            findings.append(
                Finding(
                    f"{skill.rel_path}/{rel}",
                    "unreadable",
                    f"cannot read file: {err.strerror}; check permissions",
                )
            )
    return skill, findings


def load_evals(
    evals_dir: Path,
) -> tuple[dict[str, object], frozenset[str], list[Finding]]:
    evals: dict[str, object] = {}
    findings: list[Finding] = []
    tree: set[str] = set()
    if not evals_dir.is_dir():
        return evals, frozenset(), findings
    for path in sorted(evals_dir.rglob("*")):
        tree.add(path.relative_to(evals_dir).as_posix())
    for path in sorted(evals_dir.glob("*.json")):
        try:
            evals[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError) as err:
            findings.append(
                Finding(f"evals/{path.name}", "unreadable", f"cannot read file: {err}")
            )
        except json.JSONDecodeError as err:
            findings.append(
                Finding(
                    f"evals/{path.name}",
                    "evals-format",
                    f"invalid JSON at line {err.lineno}: {err.msg}",
                )
            )
    return evals, frozenset(tree), findings


def github_escape(text: str) -> str:
    # Workflow-command escaping from the GitHub Actions docs.
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def format_finding(finding: Finding, annotate: bool) -> str:
    if annotate:
        level = "error" if finding.severity == ERROR else "warning"
        file_part = finding.path.split(":")[0].split("#")[0]
        return f"::{level} file={file_part},title={finding.rule}::{github_escape(finding.message)}"
    tag = "" if finding.severity == ERROR else " (warning)"
    return f"{finding.path}: [{finding.rule}]{tag} {finding.message}"


def main(argv: list[str]) -> int:
    assert __doc__
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    default_root = Path(__file__).resolve().parent.parent
    parser.add_argument(
        "--root", type=Path, default=default_root, help="repo root (default: this repo)"
    )
    parser.add_argument("--strict", action="store_true", help="fail on warnings too")
    args = parser.parse_args(argv)

    root: Path = args.root.resolve()
    skills_dir = root / "skills"
    if not skills_dir.is_dir():
        print(
            f"error: {skills_dir} is not a directory; pass --root <repo root>",
            file=sys.stderr,
        )
        return 2

    findings: list[Finding] = []
    skills: list[Skill] = []
    for entry in sorted(skills_dir.iterdir()):
        if entry.is_dir() and not entry.name.startswith("."):
            skill, load_findings = load_skill(entry, root)
            skills.append(skill)
            findings.extend(load_findings)
    evals, eval_tree, eval_findings = load_evals(root / "evals")
    findings.extend(eval_findings)
    findings.extend(check_all(skills, evals, eval_tree))

    annotate = os.environ.get("GITHUB_ACTIONS") == "true"
    findings.sort(key=lambda f: (f.severity != ERROR, f.path, f.rule))
    for finding in findings:
        print(format_finding(finding, annotate))

    errors = sum(f.severity == ERROR for f in findings)
    warnings = len(findings) - errors
    failed = errors > 0 or (args.strict and warnings > 0)
    if failed:
        print(
            f"\n{errors} error(s), {warnings} warning(s) in {len(skills)} skill(s). "
            "Reproduce locally: mise run check-skills",
            file=sys.stderr,
        )
        return 1
    print(
        f"checked {len(skills)} skill(s): ok"
        + (f" ({warnings} warning(s))" if warnings else "")
    )
    return 0


if __name__ == "__main__":
    if sys.version_info < MIN_PYTHON:
        sys.exit(
            f"error: Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ is required, found {sys.version.split()[0]}"
        )
    sys.exit(main(sys.argv[1:]))
