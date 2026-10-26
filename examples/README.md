# Examples

Mock sessions that show the skills and workflows working together. Each one
is a conversation, cut down to the turns that matter, with the skill or
workflow that runs named in italics.

Workflows start only when you type their name (`/implement`, `/review`,
`/release`, `/diagnose`, `/retro`, `/ask`). Every other skill loads on its
own when the request matches, or when another skill hands off to it.

| Example | Starts from | What runs |
|---|---|---|
| [Idea to release](idea-to-release.md) | "Is this worth building?" | mvp → grill → `/implement` → `/review` → docs → ship → `/release` → `/retro` |
| [A flaky test](flaky-test.md) | "CI fails sometimes" | `/diagnose` → ship CI → code TEST |
| [A breaking change](breaking-change.md) | "Can I rename this field?" | ship COMPAT → grill → docs CHANGELOG → `/release` (major) |
| [Reviewing a teammate's PR](review-a-pr.md) | A PR link | `/review` → ship REVIEW |
| [Double booking](race-condition.md) | "Sometimes two people get the same seat" | accordant SPEC → CONCURRENCY → code STATE |
| [Code nobody can test](legacy-refactor.md) | "I need to change this, but it has no tests" | code REFACTOR → `/implement` |
| [Writing a new skill](new-skill.md) | "Make a skill for database migrations" | `/ask` → writing-skills NEW → grill → `/retro` |

Not sure where to start? Type `/ask` and describe the situation.
