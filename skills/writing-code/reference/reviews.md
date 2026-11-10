# Reviews and simplification

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Review the diff against its base, then read the code around it: the callers, guards, and tests that reach each changed line.
- Before reporting a finding, trace the callers, guards, and tests that reach it, and drop it if they rule it out. Zero findings is a valid result.
- Each finding has a location (`file:line`), the input or state that breaks it, and the fix. Prefix it with its severity: `Critical` (wrong, unsafe, or loses data), `Required`, `Nit`, `Optional`, or `FYI`. Order by leverage: correctness and security, then structure, then style.
- Mark each finding as introduced by this change or pre-existing. Pre-existing defects get reported, not blocked on.
- Name the structural fix where one applies: a table for a growing conditional chain, delete a pass-through layer, move logic to the module that owns the data, reuse the existing helper. Repeated branches on the same shape mean a type is missing.
- Flag every move that lowers the bar: a new suppression without its justification, a skipped or deleted test, an assertion removed from a test that stayed, an empty `catch`, a stub or `TODO` in place of the implementation, a threshold or check loosened.
- A behavior-preserving change (refactor, simplification) passes the existing tests unmodified. If a test had to change, the behavior changed: say so.
- A simplification reduces what a reader must hold in mind; moving complexity elsewhere doesn't count. Prefer deleting an abstraction to polishing it.
- Simplify one step at a time and run the tests after each. Revert a step that breaks a test instead of patching it.
- Before deleting code that looks pointless, check its history (blame, log) for why it's there.
- Clean up only code the task touched. List anything else under "Noticed, not touched".
- Refactors and behavior changes ship as separate commits. Size rules live in the shipping-changes skill.
