# Writing a new skill

Adding a skill to this repo: `/ask` routes it, writing-skills NEW shapes
it, grill settles the open choices, and `/retro` tunes it after the first
real use.

**You:** `/ask` — I want a skill for writing database migrations.

**Agent** _(ask)_:

```text
Situation:  a new skill for writing database migrations
Skill:      writing-skills → NEW.md
Why:        "pick the packaging by who must reach it"
Then:       grill, for the choices NEW.md leaves to you
```

**You:** go

**Agent** _(writing-skills: NEW)_: NEW.md rule 1 picks the packaging. Migrations
are code that changes shared state, so the first question is whether this
is a new skill or a guide in code. A guide named MIGRATIONS.md would load
only when code's description fires, and "write a migration" already fires
code. That's a branch guide under code, not a new skill.

There are two decisions only you can make. Handing them to grill.

**Agent** _(grill)_: I read code first: STATE.md rule 5 already says the
store enforces data invariants. Round 1:

```text
Q1 · Scope: schema migrations only, or data backfills too?
→ Both: a backfill is where migrations fail in production.

Q2 · The one rule for the guide: "every migration runs forward on a
     live database, and the code before and after it both work"?
→ Yes: it's the expand-and-contract rule, and it's what ship ROLLOUT
  needs from a migration.
```

**You:** yes to both

**Agent** _(writing-skills: NEW)_: I wrote `skills/coding/code/MIGRATIONS.md`
with five numbered rules:

1. Expand, then contract
2. Never lock a hot table
3. Backfill in batches you can resume
4. Every migration has a tested rollback, or says why not
5. Test against a copy of production's shape

It ends with `## Done when`. Then I added the branch to code's "Pick a
branch", the README table, AGENTS.md, and the `/ask` map, and a hand-off
from ship ROLLOUT.md. `mise run ci` passes.

A week later, after the first real migration session:

**You:** `/retro`

**Agent** _(retro)_:

```text
medium  The agent wrote a migration that locked `orders` for 40s in
        staging, despite rule 2
        Layer:  rule
        Change: rule 2 names the check: "run `EXPLAIN` on the DDL and look
                for ACCESS EXCLUSIVE" — skills/coding/code/MIGRATIONS.md

low     The agent asked which database the repo uses;
        `docker-compose.yml` says Postgres
        Layer:  rule
        Change: none: grill step 2 already says to look facts up.
                Watch for a repeat before adding a line.
```

Apply the first?
