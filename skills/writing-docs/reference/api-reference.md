# API reference and guides

Part of the writing-docs skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- One page per operation, with a stable URL, titled with the task people search ("List org members", "Migrate from v1"), not the internal function name.
- Order each page: the signature as called, each parameter with type and meaning, the return, then one complete example. Each line says what the signature can't (what happens to an absent item), not "remove_item removes an item".
- Name the fault model: every error, with what the caller should do, and every panic, as a precondition the caller must know.
- Keep reference (signature, errors) and explanation (why it works that way) in separate sections or pages.
- Guides own the mental model: the system's nouns, their relationships, and invariants. Name the model, then map the API onto it.
- Put the happy path first, in its simplest form. Edge cases, limits, and caveats come after, clearly marked.
