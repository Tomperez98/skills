# A breaking change

A field rename in a public API. ship COMPAT catches it, grill settles how
to roll it out, and `/release` ships a major version.

**You:** I want to rename `user_name` to `username` in the `/users`
response. Is that fine?

**Agent** _(ship: COMPAT)_: It's a break. I diffed the response schema
against the last release, `v2.4.0` (ship skill, COMPAT.md rule 2):

```diff
  User:
-   user_name: string (required)
+   username: string (required)
```

Any client that reads `user_name` breaks. A break is a decision, declared
in the release with a major bump (ship skill, COMPAT.md rule 6), so this
is yours to call. Handing it to grill.

**Agent** _(grill)_: I checked the access logs: 41 distinct API keys read
`/users` in the last 30 days. Round 1:

```text
Q1 · Path: break now in v3.0.0, or ship both fields first?
→ Both fields in v2.5.0 (additive, no break), then drop `user_name`
  in v3.0.0.

Q2 · Window: how long do both fields live?
→ Two minor releases or 60 days, whichever is longer.
```

**You:** yes, but 30 days is enough.

**Agent:** Round 2:

```text
Q3 · Signal: tell clients `user_name` is going away?
→ A `Deprecation` header on `/users` responses, plus a changelog
  entry in v2.5.0.
```

**You:** yes

**Agent:** Summary: v2.5.0 adds `username` beside `user_name` and marks
`user_name` deprecated; v3.0.0, at least 30 days later, removes it.
Confirm?

**You:** confirmed. Do the first half.

**Agent** _(code: WRITE, docs: CHANGELOG)_: `/users` now returns both
fields, with the `Deprecation` header and a test for each. The changelog
entry under `Unreleased`:

```markdown
### Deprecated

- `user_name` in `/users` responses. Read `username` instead;
  `user_name` is removed in 3.0.0, no earlier than 2026-11-25.
```

The shape diff against v2.4.0 now shows one addition and no removals, so
this ships as a minor. Type `/release` when it's merged.

Thirty days later:

**You:** `/release` — the removal is merged.

**Agent** _(release)_:

1. **Version:** the shape diff against v2.5.0 removes `user_name`, a break,
   declared in the changelog. Major: `3.0.0`. The 30-day window ended
   2026-11-25; today is 2026-11-27.
2. **Changelog:** `3.0.0` leads with `### Removed`, with a migration note:
   "read `username`". Built from the merged list since `v2.5.0`.
3. **Freeze:** `9e41c0a` on remote main, CI and the compatibility check
   green.
4. **Stop and ask:** SHA `9e41c0a`, version `3.0.0`, entry above. 3 of the
   41 API keys still read `user_name` in the last week. Go, or wait?

**You:** I emailed those three. Go.

**Agent:**

5. **Published.** A clean install of `3.0.0` passes the smoke test, and
   `latest` → `3.0.0`. Done.
