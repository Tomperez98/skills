# Managing dependencies

You're adding, updating, or auditing a dependency. You ship a dependency but
you didn't write it, and the one rule still applies to it. Its documented
failures come back as values, which you translate at your boundary. When it
breaks its own contract, that's a bug, and you crash on it. An update is an
untested change to code you now own. Apply the rules in order.

## 1. Every dependency is code you own

Adding a dependency is a decision, so don't just run `install`. What you
take on is the whole transitive tree, not just the one package you named.
Before you add anything, count the tree, read the parts you'll call, and ask
whether it's worth what it costs to own. A deep tree for a helper you could
write in an afternoon isn't.

```
$ <pkg-manager> add some-http-lib  // one name...
  + 1 direct, 14 transitive        // ...fifteen packages you now own
```

## 2. Write the small ones; depend on the rest

Match how you own it to how big and how risky the code is:

- **Small helpers** (a `deepEquals`, a retry loop, string padding): write
  them yourself. They're easy to write, and every tiny package is one more
  maintainer account an attacker can take over.
- **Mid-size libraries**: depend on them. Fork and trim one only when you
  use a small, stable slice of it. Code you deleted can't break, but a fork
  stops receiving upstream fixes, so you now watch upstream for security
  fixes yourself. Don't fork on the user's behalf without saying so.
- **Hard problems** (cryptography, network protocols, heavy frameworks):
  depend on them. You can't really own a fork of these, so a home-grown
  version or a stale fork is riskier than the upstream project.

## 3. Pin every version; vendor what you forked

Every version is exact and locked, including transitive ones. Keep forks in
your own repo. After that, nothing changes unless you change it, and each
change to a dependency shows up as a diff you can review. A floating range
like `^1.2` lets someone else decide what you ship.

## 4. Update on purpose, not automatically

Every update needs a stated reason, and a new version existing isn't one.
An update ships changes from the whole transitive tree, so a bot PR is a
proposal to review, not something to auto-merge.

Good reasons: a security fix, a bug your users hit, a feature you need, or
staying within reach of a runtime or toolchain upgrade. Not every security
fix gets a CVE, so read release notes for the packages you rely on. Skipped
updates also pile up. Five major versions at once is a harder, riskier
migration than five separate ones, so take updates in small, reviewed steps
rather than never.

## 5. Review in proportion to risk

Match the review to what the update can break. A patch release of a leaf
package needs a glance at its changelog. A major version, a package that
handles untrusted input or credentials, or a new transitive dependency
needs its diff read for the code paths you actually call.

State what you reviewed and what you didn't. If you can't review an update
enough to trust it, take a smaller one: the minimum version with the fix
you need.

## 6. Wrap it behind one boundary

Only one module calls the dependency. That module maps the dependency's
errors into your own vocabulary, once (WRITE.md: one error vocabulary per
boundary), and parses its output at the edge (WRITE.md: parse at the edge).
Its documented failures come back as your values. If it returns something
its contract rules out, that's a bug in code you own, so panic.

```
fn fetch_rate(pair) -> Result<Rate, RateError> {
    let raw = vendor_client.quote(pair)
        .map_err(|e| RateError::Upstream(e.kind))   // expected → our value
    assert(raw.price > 0, "vendor broke contract")  // impossible → panic
    Ok(Rate::from(raw))
}
```

With one boundary, replacing, forking, or trimming the dependency touches a
single file.

## 7. Pin the behavior you rely on with tests

Write tests against your boundary that cover the parts of the dependency you
actually use: the outputs you parse and the errors you map. These tests make
rules 4–5 affordable: the review can focus on what the tests don't cover.
When you take an update, a change in behavior fails a test at the line
where it matters, instead of turning up later in production.

---

A dependency is part of your program, so it follows the same contract as
the rest of the code. WRITE.md builds the boundary around it, TEST.md pins
the behavior you rely on, and this branch decides whether the code gets in
at all and when it's allowed to change.
