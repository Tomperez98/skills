# Rolling out several services

You're shipping several services or parts that talk to each other, and the
old and new versions will run side by side while the deploy rolls out.
Each service already passes its own compatibility checks (COMPAT.md); these
rules check the pairs. Adopt them one service at a time, starting with the
one the most others depend on: each check below costs real infrastructure,
and it pays first where a break would hurt the most callers. Apply the
rules in order.

## 1. Release the services in lockstep

A repo with several services releases them together, under one version
from the changelog (RELEASE.md rule 3). One version means one baseline,
and the only pair that ever has to work together is the last release, N-1,
and the new one, N. Give a service its own version, tag prefix, and
baseline only when it truly needs its own cadence; it then applies these
rules on its own, and every one you split out multiplies the pairs to
check.

## 2. Green at HEAD proves nothing about the rollout; check N-1 both ways

A pull request that changes a provider and its consumer together passes at
HEAD, because both sides match there. Production never runs HEAD alone:
deploys roll out one service at a time, so N-1 and N run side by side for
minutes or hours. Check both directions on every pull request that touches
a contract between services:

- **Backward:** N-1's suites, every service's, judge N's build (COMPAT.md
  rule 5).
- **Forward:** N's suites judge N-1's build, because during the rollout new
  consumers reach old providers.

Run only the directions your deploy order (rule 3) can produce: when
providers always upgrade first, new consumers never meet an old provider,
and backward alone covers it. An order nothing enforces needs both. A
forward failure on a promise that is new in N (a field or operation N-1
lacks) is no defect; it is an ordering requirement, so the provider ships
in an earlier release or step than the code that calls it.

## 3. Test the rollout in the order you deploy

Write the deploy order down and script it, usually providers before
consumers. Then test exactly that order: start every service at N-1,
upgrade them one at a time, and keep every spec judging the whole way.
Run it before each release (RELEASE.md rule 6) and on a schedule with
faults injected (COMPAT.md rule 7), since a restart mid-request is part of
every real rollout.

## 4. Enforce the window at runtime

The supported window is N-1 to N. Make callers announce their version and
refuse anyone outside it with a clear "too old" or "too new" error. A
caller outside the window otherwise gets undefined behavior, and the first
sign is corrupt data instead of an error.

Where rollbacks or on-premises installs keep older versions running, the
window is wider than N-1. Keep each shipped contract (COMPAT.md rule 4) for
every version still supported, run COMPAT.md rule 5 against each, and
delete one when its version leaves the window. Each version adds a suite
run, so the window's width is a cost you choose, not a default.

## 5. Messages and data outlive the deploy

Events already in queues and rows already stored were written by N-1, so N
must read them. Events are part of the API: replay N-1's recorded events
through N's specs. Stored data isn't, and the specs can't see it: check it
by migrating a copy of N-1's data, then reading it back through N's API
with the specs judging the responses. A schema change to stored data runs
as expand, migrate, contract, spread over at least two releases: add the
new shape and write both, move readers over, then remove the old shape
once no N-1 code is left. The order of the steps matters, and each
check enforces one:

- **Widen readers before the data loosens.** Old code that expects a value
  breaks when the field becomes optional: ship code that accepts both
  first (the backward check, rule 2).
- **Add the new shape before the code that uses it.** Code that writes a
  field in the pull request that adds it breaks on N-1 (the forward
  check, rule 2).

## Done when

- The services share one version and baseline, or each one split out has
  its own version, tag prefix, and baseline (rule 1).
- Every direction the deploy order can produce ran green, and the scripted
  rollout from N-1 to N ran green with every spec judging (rules 2 and 3).
- A caller outside the supported window gets a "too old" or "too new"
  error (rule 4).
- N-1's recorded events and a migrated copy of N-1's data read back
  through N's API with the specs judging (rule 5).
