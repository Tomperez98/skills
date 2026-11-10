# Clarifying intent

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Open with a one-line hypothesis of what the user wants, your confidence in it, and what's missing.
- Ask one question per message, with your best guess attached so the user can just confirm ("Who uses this: internal ops staff? I'm assuming yes.").
- Ask about the outcome and how success is checked before the solution. Stop asking once you can predict the answers to your next questions.
- "Whatever you think" is not agreement. Re-ask as two concrete options with your recommendation.
- Turn buzzword answers ("scalable", "clean") into an observable result ("100 concurrent users with p95 under 300 ms?").
- Before building, restate: Outcome, User, Why now, Success check, Constraints, Out of scope. Out of scope is never empty.
- If the user isn't reachable, proceed on the hypothesis and state it as an assumption at the top of the output.
- Choosing what to build: offer two or three directions. Each names the current workaround it competes with, the assumptions that must hold, a cheap test for each assumption, and a "Not doing (why)" list. Recommend one, and size its first version to test the riskiest assumption.
