"""Tests for check_skills.py. Run: python3 -B -m unittest discover -s scripts

Each rule has a failing case that must report its rule id, next to a clean
baseline (`GOOD`) that must report nothing, so a rule that stops firing or
starts over-firing fails here.
"""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import check_skills as cs

FRONT = (
    "---\nname: {name}\ndescription: Extracts text from PDFs. "
    "Use when working with PDF files.\n---\n"
)
GOOD = {
    "SKILL.md": FRONT.format(name="processing-pdfs")
    + "# Processing PDFs\n- Forms → [reference/forms.md](reference/forms.md)\n",
    "reference/forms.md": "# Forms\n\n- Fill fields by name.\n",
}


def make_skill(files=None, name="processing-pdfs"):
    return cs.Skill(name, f"skills/{name}", dict(GOOD if files is None else files))


def with_files(**changes):
    """GOOD plus overrides; a value of None deletes the file."""
    files = dict(GOOD)
    for rel, text in changes.items():
        rel = rel.replace("__", "/")
        if "." not in rel:
            rel += ".md"  # keyword names can't hold a dot, so `.md` is implied
        if text is None:
            files.pop(rel)
        else:
            files[rel] = text
    return files


def rules(findings):
    return {f.rule for f in findings}


def run_checks(skill):
    return [f for check in cs.SKILL_CHECKS for f in check(skill)]


class BaselineTest(unittest.TestCase):
    def test_good_skill_has_no_findings(self):
        self.assertEqual(run_checks(make_skill()), [])


class FrontmatterTest(unittest.TestCase):
    def skill_with(self, front, name="processing-pdfs"):
        return make_skill(with_files(**{"SKILL.md": front + "# Body\n"}), name)

    def test_missing_frontmatter(self):
        found = cs.check_frontmatter(self.skill_with(""))
        self.assertEqual(rules(found), {"frontmatter"})

    def test_unclosed_frontmatter(self):
        found = cs.check_frontmatter(self.skill_with("---\nname: x\n"))
        self.assertIn("not closed", found[0].message)

    def test_multiline_value_is_reported(self):
        found = cs.check_frontmatter(
            self.skill_with("---\nname: a\n  continued\n---\n")
        )
        self.assertEqual(rules(found), {"frontmatter"})

    def test_name_rules(self):
        cases = {
            "Processing-PDFs": "lowercase",
            "a" * 65: "65 characters",
            "claude-pdfs": "reserved word 'claude'",
            "anthropic-tools": "reserved word 'anthropic'",
            "pdf-helper": "vague word 'helper'",
            "pdf_forms": "lowercase",
        }
        for name, expected in cases.items():
            with self.subTest(name=name):
                front = FRONT.format(name=name)
                found = cs.check_frontmatter(self.skill_with(front, name=name))
                self.assertTrue(any(expected in f.message for f in found), found)

    def test_name_must_match_directory(self):
        front = FRONT.format(name="other-name")
        found = cs.check_frontmatter(self.skill_with(front))
        self.assertEqual(rules(found), {"name-dir"})

    def test_description_rules(self):
        base = "---\nname: processing-pdfs\ndescription: {}\n---\n"
        cases = {
            "": "description",
            "x" * 1025 + " Use when a.": "description",
            "Extracts <b>text</b>. Use when a.": "description",
            "I can extract text. Use when a.": "description-person",
            "Extracts text for you. Use when a.": "description-person",
        }
        for text, rule in cases.items():
            with self.subTest(text=text[:30]):
                found = cs.check_frontmatter(self.skill_with(base.format(text)))
                self.assertIn(rule, rules(found))

    def test_quoted_you_is_allowed(self):
        front = (
            "---\nname: processing-pdfs\n"
            'description: Extracts text. Use when asked "can you read this".\n---\n'
        )
        self.assertEqual(cs.check_frontmatter(self.skill_with(front)), [])

    def test_missing_use_when_is_a_warning(self):
        front = (
            "---\nname: processing-pdfs\ndescription: Extracts text from PDFs.\n---\n"
        )
        found = cs.check_frontmatter(self.skill_with(front))
        self.assertEqual(
            [(f.rule, f.severity) for f in found], [("description-trigger", cs.WARNING)]
        )


class BodySizeTest(unittest.TestCase):
    def body_of(self, lines):
        text = FRONT.format(name="processing-pdfs") + "\n".join(["line"] * lines) + "\n"
        return cs.check_body_size(make_skill(with_files(**{"SKILL.md": text})))

    def test_thresholds(self):
        self.assertEqual(self.body_of(cs.BODY_WARN_LINES - 1), [])
        self.assertEqual(self.body_of(cs.BODY_WARN_LINES)[0].severity, cs.WARNING)
        self.assertEqual(self.body_of(cs.BODY_MAX_LINES - 1)[0].severity, cs.WARNING)
        self.assertEqual(self.body_of(cs.BODY_MAX_LINES)[0].severity, cs.ERROR)


class LinkTest(unittest.TestCase):
    def test_broken_link(self):
        skill = make_skill(
            with_files(
                **{
                    "SKILL.md": GOOD["SKILL.md"]
                    + "- Tables → [t](reference/tables.md)\n"
                }
            )
        )
        found = cs.check_links(skill)
        self.assertEqual(rules(found), {"link-broken"})
        self.assertIn("reference/tables.md", found[0].message)

    def test_link_in_code_is_ignored(self):
        text = GOOD["SKILL.md"] + "Example: `[x](missing.md)`\n```\n[y](gone.md)\n```\n"
        self.assertEqual(
            cs.check_links(make_skill(with_files(**{"SKILL.md": text}))), []
        )

    def test_url_and_anchor_are_ignored(self):
        text = GOOD["SKILL.md"] + "Docs → [a](https://example.com) and [b](#top)\n"
        self.assertEqual(
            cs.check_links(make_skill(with_files(**{"SKILL.md": text}))), []
        )

    def test_link_outside_skill_warns(self):
        text = GOOD["SKILL.md"] + "Other → [x](../writing-code/SKILL.md)\n"
        found = cs.check_links(make_skill(with_files(**{"SKILL.md": text})))
        self.assertEqual(
            [(f.rule, f.severity) for f in found], [("link-outside", cs.WARNING)]
        )

    def test_file_linked_from_nowhere(self):
        found = cs.check_links(make_skill(with_files(reference__extra="# Extra\n")))
        self.assertEqual(rules(found), {"file-unlinked"})
        self.assertIn("nowhere", found[0].message)

    def test_file_reachable_only_through_another_file(self):
        files = with_files(
            reference__forms="# Forms\n[more](advanced.md)\n",
            reference__advanced="# Advanced\n",
        )
        found = cs.check_links(make_skill(files))
        self.assertEqual(rules(found), {"file-unlinked"})
        self.assertIn("only from reference/forms.md", found[0].message)

    def test_script_named_by_path_counts_as_linked(self):
        text = GOOD["SKILL.md"] + "Run `scripts/check.py` to validate.\n"
        files = with_files(**{"SKILL.md": text, "scripts__check.py": "print(1)\n"})
        self.assertEqual(cs.check_links(make_skill(files)), [])

    def test_link_without_task_warns(self):
        text = (
            FRONT.format(name="processing-pdfs")
            + "- See also [forms](reference/forms.md)\n"
        )
        found = cs.check_links(make_skill(with_files(**{"SKILL.md": text})))
        self.assertEqual(
            [(f.rule, f.severity) for f in found], [("link-trigger", cs.WARNING)]
        )

    def test_one_word_task_is_a_trigger(self):
        text = (
            FRONT.format(name="processing-pdfs")
            + "- Forms → [forms](reference/forms.md)\n"
        )
        self.assertEqual(
            cs.check_links(make_skill(with_files(**{"SKILL.md": text}))), []
        )


class ReferenceTocTest(unittest.TestCase):
    def long_file(self, head):
        return head + "\n".join(["- rule"] * (cs.REFERENCE_TOC_OVER_LINES + 5)) + "\n"

    def test_long_file_without_toc(self):
        found = cs.check_reference_toc(
            make_skill(with_files(reference__forms=self.long_file("# Forms\n")))
        )
        self.assertEqual(rules(found), {"reference-toc"})

    def test_contents_heading_satisfies(self):
        head = "# Forms\n\n## Contents\n- a\n- b\n\n"
        self.assertEqual(
            cs.check_reference_toc(
                make_skill(with_files(reference__forms=self.long_file(head)))
            ),
            [],
        )

    def test_anchor_list_satisfies(self):
        head = "# Forms\n[a](#a)\n[b](#b)\n[c](#c)\n"
        self.assertEqual(
            cs.check_reference_toc(
                make_skill(with_files(reference__forms=self.long_file(head)))
            ),
            [],
        )

    def test_short_file_needs_none(self):
        self.assertEqual(cs.check_reference_toc(make_skill()), [])


class PathAndNameTest(unittest.TestCase):
    def test_backslash_path(self):
        text = GOOD["SKILL.md"] + "Read reference\\forms.md first.\n"
        found = cs.check_paths(make_skill(with_files(**{"SKILL.md": text})))
        self.assertEqual(rules(found), {"path-slash"})
        self.assertIn("reference/forms.md", found[0].message)

    def test_generic_file_name(self):
        found = cs.check_file_names(make_skill(with_files(reference__doc2="# x\n")))
        self.assertEqual(rules(found), {"file-name"})


class StaleDateTest(unittest.TestCase):
    def check(self, line):
        text = GOOD["SKILL.md"] + line + "\n"
        return cs.check_stale_dates(make_skill(with_files(**{"SKILL.md": text})))

    def test_flagged(self):
        for line in [
            "Before August, use the old API.",
            "Updated 2025-03-04.",
            "Released March 2025.",
            "Planned for Q3 2026.",
            "As of Jan 5, 2026 this changed.",
        ]:
            with self.subTest(line=line):
                self.assertEqual(rules(self.check(line)), {"stale-date"})

    def test_not_flagged(self):
        for line in [
            "Use the current method.",
            'Never write "before August, use the old API".',
            "Run `date 2025-03-04` to see it.",
            "May the best option win.",
        ]:
            with self.subTest(line=line):
                self.assertEqual(self.check(line), [])

    def test_old_patterns_section_is_exempt_until_next_heading(self):
        text = (
            GOOD["SKILL.md"]
            + "## Old patterns\nBefore August use v1.\n## Next\nBefore August use v2.\n"
        )
        found = cs.check_stale_dates(make_skill(with_files(**{"SKILL.md": text})))
        self.assertEqual(
            [f.path.rsplit(":", 1)[1] for f in found],
            [str(text.count("\n", 0, text.index("v2")) + 1)],
        )

    def test_details_block_is_exempt(self):
        text = (
            GOOD["SKILL.md"]
            + "<details><summary>Old patterns</summary>\nBefore August use v1.\n</details>\n"
        )
        self.assertEqual(
            cs.check_stale_dates(make_skill(with_files(**{"SKILL.md": text}))), []
        )


class ScriptTest(unittest.TestCase):
    def skill(self, script, mention):
        text = GOOD["SKILL.md"] + mention
        return make_skill(with_files(**{"SKILL.md": text, "scripts__check.py": script}))

    def test_clean_script(self):
        skill = self.skill("print(1)\n", "Run `scripts/check.py` to validate.\n")
        self.assertEqual(cs.check_scripts(skill), [])

    def test_syntax_error(self):
        skill = self.skill("def (:\n", "Run `scripts/check.py`.\n")
        self.assertEqual(rules(cs.check_scripts(skill)), {"script-syntax"})

    def test_unreferenced_script(self):
        skill = make_skill(with_files(**{"scripts__check.py": "print(1)\n"}))
        self.assertEqual(rules(cs.check_scripts(skill)), {"script-referenced"})

    def test_run_or_read_missing_warns(self):
        skill = self.skill("print(1)\n", "The `scripts/check.py` file exists.\n")
        found = cs.check_scripts(skill)
        self.assertEqual(
            [(f.rule, f.severity) for f in found], [("script-run-or-read", cs.WARNING)]
        )


def scenario(**changes):
    base = {
        "skills": ["processing-pdfs"],
        "query": "Fill this form.",
        "files": [],
        "expected_behavior": ["Reads reference/forms.md before filling"],
    }
    base.update(changes)
    return base


class EvalsTest(unittest.TestCase):
    TREE = frozenset({"fixtures", "fixtures/form"})
    KNOWN = frozenset({"processing-pdfs"})

    def check(self, evals, skill=None):
        return cs.check_evals(
            skill or make_skill(),
            evals,
            "evals/processing-pdfs.json",
            self.TREE,
            self.KNOWN,
        )

    def test_good(self):
        self.assertEqual(self.check([scenario()] * 3), [])

    def test_missing_file(self):
        self.assertEqual(rules(self.check(None)), {"evals-missing"})

    def test_top_level_not_a_list(self):
        self.assertEqual(rules(self.check({})), {"evals-format"})

    def test_too_few_scenarios(self):
        found = self.check([scenario()] * 2)
        self.assertEqual(rules(found), {"evals-count"})

    def test_scenarios_for_other_skills_do_not_count(self):
        found = self.check([scenario()] * 2 + [scenario(skills=["other"])])
        self.assertEqual(rules(found), {"evals-count", "evals-skill-unknown"})

    def test_field_formats(self):
        for change in [
            {"query": ""},
            {"expected_behavior": []},
            {"expected_behavior": [""]},
            {"skills": []},
            {"files": "fixtures"},
        ]:
            with self.subTest(change=change):
                found = self.check([scenario(**change)] * 3)
                self.assertIn("evals-format", rules(found))

    def test_unknown_skill_names_the_valid_ones(self):
        found = self.check([scenario()] * 3 + [scenario(skills=["nope"])])
        message = next(f.message for f in found if f.rule == "evals-skill-unknown")
        self.assertIn("'nope'", message)
        self.assertIn("processing-pdfs", message)

    def test_missing_fixture(self):
        found = self.check([scenario(files=["fixtures/gone"])] * 3)
        self.assertEqual(rules(found), {"evals-file-missing"})

    def test_existing_fixture_dir(self):
        self.assertEqual(self.check([scenario(files=["fixtures/form"])] * 3), [])

    def test_navigation_untested(self):
        found = self.check([scenario(expected_behavior=["Fills the form"])] * 3)
        self.assertEqual(rules(found), {"evals-navigation"})

    def test_skill_without_references_needs_no_navigation(self):
        skill = make_skill(
            {"SKILL.md": FRONT.format(name="processing-pdfs") + "# Body\n"}
        )
        found = self.check([scenario(expected_behavior=["Fills the form"])] * 3, skill)
        self.assertEqual(found, [])


class CollectionTest(unittest.TestCase):
    def test_no_skills_is_an_error(self):
        self.assertEqual(rules(cs.check_collection([], frozenset())), {"no-skills"})

    def test_orphan_eval(self):
        found = cs.check_collection(
            [make_skill()], frozenset({"processing-pdfs", "ghost"})
        )
        self.assertEqual(rules(found), {"evals-orphan"})

    def test_mixed_name_pattern(self):
        skills = [make_skill(name="processing-pdfs"), make_skill(name="pdf-processing")]
        found = cs.check_collection(skills, frozenset())
        self.assertEqual(
            [(f.rule, f.path) for f in found],
            [("name-pattern", "skills/pdf-processing")],
        )


class MainTest(unittest.TestCase):
    """End to end: build a repo on disk and run main()."""

    def build(self, root, skill_files=None, evals=None):
        for rel, text in (GOOD if skill_files is None else skill_files).items():
            path = root / "skills" / "processing-pdfs" / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        if evals is None:
            evals = [scenario()] * 3
        (root / "evals").mkdir(exist_ok=True)
        (root / "evals" / "processing-pdfs.json").write_text(
            json.dumps(evals), encoding="utf-8"
        )

    def run_main(self, root, *args):
        with (
            contextlib.redirect_stdout(io.StringIO()),
            contextlib.redirect_stderr(io.StringIO()),
        ):
            return cs.main(["--root", str(root), *args])

    def test_clean_repo_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.build(Path(tmp))
            self.assertEqual(self.run_main(Path(tmp), "--strict"), 0)

    def test_error_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.build(Path(tmp), evals=[scenario()])
            self.assertEqual(self.run_main(Path(tmp)), 1)

    def test_warning_fails_only_when_strict(self):
        files = with_files(**{"SKILL.md": GOOD["SKILL.md"] + "Before August use v1.\n"})
        with tempfile.TemporaryDirectory() as tmp:
            self.build(Path(tmp), skill_files=files)
            self.assertEqual(self.run_main(Path(tmp)), 0)
            self.assertEqual(self.run_main(Path(tmp), "--strict"), 1)

    def test_invalid_eval_json_is_a_finding_not_a_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.build(Path(tmp))
            (Path(tmp) / "evals" / "processing-pdfs.json").write_text(
                "{nope", encoding="utf-8"
            )
            self.assertEqual(self.run_main(Path(tmp)), 1)

    def test_binary_asset_is_not_a_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.build(Path(tmp))
            (
                Path(tmp) / "skills" / "processing-pdfs" / "reference" / "logo.png"
            ).write_bytes(b"\xff\xfe\x00")
            # The asset is unlinked, so the run fails on that rule, not on a decode error.
            self.assertEqual(self.run_main(Path(tmp)), 1)

    def test_missing_skills_dir_is_a_usage_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(self.run_main(Path(tmp)), 2)

    def test_empty_skills_dir_is_not_green(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "skills").mkdir()
            self.assertEqual(self.run_main(Path(tmp)), 1)


class FormatTest(unittest.TestCase):
    def test_plain(self):
        f = cs.Finding("skills/x/SKILL.md:3", "link-broken", "bad link")
        self.assertEqual(
            cs.format_finding(f, annotate=False),
            "skills/x/SKILL.md:3: [link-broken] bad link",
        )

    def test_github_annotation_escapes_newlines(self):
        f = cs.Finding("evals/x.json#2", "evals-format", "a\nb", cs.WARNING)
        self.assertEqual(
            cs.format_finding(f, annotate=True),
            "::warning file=evals/x.json,title=evals-format::a%0Ab",
        )


if __name__ == "__main__":
    unittest.main()
