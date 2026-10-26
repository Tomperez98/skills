# Reviewing a teammate's PR

`/review` on someone else's change: fix the intent first, check each
dimension, and report only what survived a refutation attempt.

**You:** `/review` PR #212

**Agent** _(review)_:

**1. Fix the diff and its intent.** Base `4be0d17`, the merge base with
main. 11 files, +640 −120. Intent, from the PR description: "add retry with
backoff to the webhook sender."

Done: base, file list, and intent.

**2. Review by dimension.** At 760 changed lines, I sent five sub-agents in
parallel, one each for intent, errors, structure, tests, and contract. Each
got the base, the file list, and the intent. They came back with nine
candidates.

**3. Try to refute each finding.** Dropped five:

- "No jitter on backoff": `backoff.ts:8` adds jitter; the sub-agent read
  only the hunk.
- "Retries forever": `maxAttempts` defaults to 5 in `config.ts`.
- Three style notes that no guide rule backs.

**4. Report, most severe first.**

```text
high    src/webhook/send.ts:44  Retries a 4xx; a 400 from the receiver is
                                retried 5 times, then marked delivered
        Rule:    code skill, WRITE.md rule 2 (return a value for expected
                 failures)
        Failure: receiver returns 400 → 5 calls, status "delivered"
        Verdict: confirmed, ran the test below against a stub server

high    src/webhook/send.ts:61  A timeout is treated as "not sent", but the
                                receiver may have acted; a retry can
                                deliver twice
        Rule:    code skill, CRASHONLY.md rule 4 (make retryable effects
                 idempotent)
        Failure: receiver acts, then times out → second delivery, no key
        Verdict: plausible, traced end to end; no stub for a slow receiver

medium  test/webhook.test.ts    Every retry test uses real timers; the
                                suite sleeps 14s
        Rule:    code skill, TEST.md rule 4 (test retries deterministically)
        Failure: CI time +14s per run, and flaky under load
        Verdict: confirmed, timed it

low     src/webhook/types.ts:3  Adds `retryCount` to the public `Webhook`
                                type
        Rule:    ship skill, COMPAT.md rule 1 (the contract has two layers)
        Failure: additive, not a break, but it needs the `additive` label
        Verdict: confirmed, shape diff
```

Which should I post as review comments?

**You:** all four, as comments. Don't fix anything, it's their PR.

**Agent** _(ship: REVIEW)_: Posted four comments on #212, each with the
failure and the rule. I added the `contract:additive` label for the
`retryCount` field and left the PR unapproved.
