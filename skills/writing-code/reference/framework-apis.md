# Framework and library APIs

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Before writing against a framework or library API, read its exact version from the lockfile, or from the manifest when there's no lockfile.
- Check a version-sensitive API against that version's official reference, not memory. Rank sources: official reference, then the official changelog or migration guide, then standards (RFCs, MDN). Blogs, Q&A sites, and AI summaries don't count as verification.
- Follow the codebase's existing pattern for that API. When the docs' current pattern differs, keep the codebase's and tell the user about the difference; never mix both.
- An API you couldn't verify (no network, no docs for that version) is marked `UNVERIFIED` in the response, with what to check.
- Don't copy telemetry, analytics, or third-party endpoints from a docs example into code without telling the user.
- Cite the doc page (a deep link) in the response. A link goes in a code comment only when the code works around a vendor quirk.
