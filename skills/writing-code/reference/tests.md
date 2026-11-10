# Tests

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Assert the variant before the payload. Write one test per error variant, with its payload.
- Test short-circuiting: record calls and assert later steps did NOT run after an early failure.
- Test retries deterministically: inject the operation, use zero delay, and assert the exact attempt list.
- Defects panic and expected failures return: assert a crash with the framework's should-panic/throw assertion, and assert an expected failure on the returned variant. Generate only inputs that satisfy the precondition.
- Test helpers crash on failure instead of returning Results.
- Pass config as a value. Never mutate env vars or process-wide state in tests. Test the env-to-config seam by passing `env` as a map. Each test owns its state and runs in any order. Name the suite's wall-clock budget.
- Expect/snapshot tests: render a small, deterministic, human-readable story, not a dump. Keep it next to the test, with several expectations per scenario. Normalize IDs, timestamps, and ordering. A change that rewrites hundreds of expectations is too big to review: split it or assert the contract.
- Pin important signatures with a compile-time type assertion.
- Property tests for contracts: postcondition/invariant, round-trip (`parse(render(x)) == Ok(x)`), oracle, split/combine (assert the empty case: `all([])` is true), simulated clock and network, and the same suite against every implementation. Generators include empty, single, duplicate, and boundary inputs. Keep each shrunk counterexample as an example test. Fix or log the seed.
- Kill a mutant. Unit tests: a mechanical mutation. System/property tests: a semantic bug that is reached (e.g. restore an older snapshot). Only "caught at the broken assertion" counts. "Never ran" is inconclusive, and "ran unnoticed" means strengthening the test. Keep the budget small, and revert every mutant before committing.
- Crash tests: kill mid-write without cleanup, restart, and assert the state is rebuilt or dropped, never corrupt. Apply an idempotent operation twice and assert one effect. Assert the worker's ack precedes the release on async cancellation.
