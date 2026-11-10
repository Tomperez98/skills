# Notice

The files in `reference/` and `assets/starter/` are adapted from [microsoft/accordant](https://github.com/microsoft/accordant) at commit `30a1dced713d0af39440662464a975471e5fd779`. [SKILL.md](SKILL.md) overrides the upstream text where it is wrong, instead of editing the copies, so a resync stays a plain copy.

| Upstream | Bundled as |
| --- | --- |
| `agent/skills/<topic>/SKILL.md` for state, operations, test-generation, patterns, concurrency, async-operations, troubleshooting, quickref | `reference/<topic>.md` |
| `docs/how-to/<page>.md` for validating-your-model, indefinite-failures, test-logs, resetting-state, modeling-large-data, better-error-messages, testing-any-system | `reference/<page>.md` |
| `docs/concepts/<page>.md` for request-derivations, conformance-testing, models-vs-fakes | `reference/<page>.md` |
| `docs/concepts/step-functions-and-async.md` | `reference/step-functions.md` |
| `agent/starter/*.cs` | `assets/starter/` |

Not bundled: `agent/skills/overview` (covered by `SKILL.md`), `agent/skills/cross-language` (a short version of `testing-any-system.md`), `agent/INSTALL.md`, the tutorials, and the concept pages that repeat the skills (`understanding-state`, `operations-and-expect`, `how-test-generation-works`, `what-is-model-based-testing`).

Edits made to each copy: frontmatter removed, trailing "Next Steps", "See Also", "Getting Help", or "Documentation" section removed, a provenance line and a table of contents added, links to other bundled pages pointed at the bundled file, and every other relative link made an absolute GitHub URL.

To resync: copy each upstream file over its bundled name, repeat the edits above, run `mise run fmt` (upstream Markdown has lint gaps), update the commit here, and re-check the overrides in `SKILL.md` against the new text.

## License

```text
MIT License

Copyright (c) 2024-2026 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
