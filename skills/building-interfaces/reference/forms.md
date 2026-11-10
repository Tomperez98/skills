# Forms

Part of the building-interfaces skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Validate in the form for speed and on the server for truth. The server's answer wins, and its errors map back to fields.
- Show each error beside its field, in text, saying how to fix it ("Use 8 or more characters"). On submit, move focus to the first invalid field, or to a summary that links to each one.
- Validate a field on blur or submit, not on every keystroke; clear its error as soon as the value becomes valid.
- Use the input type, `autocomplete` token, and input mode that match the data, so browsers and password managers can fill it.
- Never discard what the user typed: on an error, keep every value. Warn before leaving a form with unsaved changes.
- A multi-step form shows where the user is and how many steps remain, and keeps earlier answers when they go back.
