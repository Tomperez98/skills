# Architecture decision records

Part of the writing-docs skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Write an ADR for a decision that is expensive to reverse: a datastore, a core dependency, the data model, auth, the API style, or the deploy topology.
- Follow the repo's existing ADR location, numbering, and headings. With none, use `docs/adr/NNNN-short-title.md`. Never start a second scheme; if two already exist, say so instead of picking one silently.
- Sections in order: Status (proposed, accepted, or superseded by NNNN), Context (the forces, with numbers), Decision (one sentence first, then detail), Alternatives (each with why it lost), Consequences (including what gets harder).
- Write it in the same change that implements the decision, not afterwards.
- Never edit an accepted ADR's decision. Write a new ADR that supersedes it, and link the two both ways.
