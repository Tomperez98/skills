# Writing API references and guides

The reader is mid-task, on a clock, and already frustrated. A reference page
must get them from "how do I call this?" to a working call with zero
detours. Apply the rules in order. (This file covers *reference* and
*explanation*; for step-by-step learning content, see TUTORIAL.md — the two
are different and belong in different places.)

## 1. One page per operation, one operation per page

Each function, endpoint, or type gets its own page with a stable URL, so a
search hit lands the reader exactly on the answer. Don't stack twenty
endpoints on one page; the reader can't link to, search within, or skim it.

## 2. Signature first, then parameters, then example

Order: the signature (exactly as it's called), each parameter with its type
and meaning, the return, then one complete example. A reference is not a
narrative — it's the answer in a fixed shape.

```
// fetch_user(id: UserId) -> Result<User, UserError>
//
// id — the user to look up.
// Returns Ok(User) or one of UserError (see below).
```

## 3. Name the fault model

List every way the operation can fail, with its error and what the caller
should do. A reference that omits the errors is a map without the cliffs.
This is the documentation side of "one error vocabulary per boundary" — see
the code skill.

```
Errors:
- NotFound(id)        — no such user; the caller should 404.
- StoreUnavailable(e) — the store is down; the caller should retry later.
```

## 4. One complete example per operation

Copy-paste complete: the imports, a minimal but realistic input, the call,
and the output shown. An example with `...` in the argument list teaches the
reader to guess, and they'll guess wrong.

## 5. Split reference from explanation

Reference (this is the signature and the errors) and explanation (this is
why it works that way) are different readers at different moments. Keep them
in separate sections or separate pages. A reader who needs the signature
should never wade through prose; a reader who needs the *model* needs prose,
not a signature.

## 6. Explain the mental model, not just the API

The guides half of your docs owns the concepts: the nouns of your system,
their relationships, and the invariants. Explain the model the reader needs
in their head to use the API without reading every page. Name it, then map
the API onto it.

```
Users belong to exactly one org; a session belongs to a user. An org-scoped
token can read anything in the org; a user-scoped token can read only
itself.
```

## 7. Write titles people actually search

The page title is the search query the reader typed: "Retry a failed
request", "List org members", "Migrate from v1". Use the verb-noun form of
the task, not the internal name of the function. The URL inherits it.

## 8. Keep the happy path first, edge cases after

Lead with the common call in its simplest form. Edge cases, limits, and
caveats come after, clearly marked, so the common reader gets the answer
fast and the careful reader can go deeper. Never bury the 90% path behind
the 10% caveats.

## 9. Mark every snippet with the language

A code fence without a language is unreadable for half your readers. Fence
with the language so syntax highlighting and copy-paste both work.
