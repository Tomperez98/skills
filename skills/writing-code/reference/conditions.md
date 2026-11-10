# Conditions and decisions

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Rewrite conditions with logic rules (De Morgan, distribution, double negation), one rule per step. Only do this when the clauses are pure: short-circuiting and mutation break the algebra. Inside `if P`, don't re-check `P`.
- Write search loops as `any`/`all`. Merge quantifiers into one pass and hoist terms that don't depend on the loop variable. Express implication as a filter: `all(Q(x) for x in xs if P(x))`.
- For a decision over several inputs, write a table first (inputs as columns, `-` for "doesn't matter"). Check it's complete (rows cover every combination, so count them) and unambiguous (no overlaps). Ask about gaps; don't guess.
- Test the table: one case per row, plus one test that enumerates every input combination and asserts exactly one row matches.
- Prove each rewrite against the original. Enumerate the truth table for small Boolean domains, use random inputs as an oracle for large ones, and compare recorded side-effect sequences, not just values. Delete the old version once the change lands.
