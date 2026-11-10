---
name: shipping-changes
description: Applies rules for commits and pull requests, CI pipelines, compatibility and breaking-change checks, versioning, releases, publishing to package registries, deploys, feature flags, schema migrations, multi-service rollout, alerting, and monitoring main. Use when writing a commit message, splitting work into commits, opening a PR, setting up or changing CI workflows, pinning tools or actions, detecting breaking changes, bumping a version, cutting or tagging a release, publishing packages, handling release credentials, deploying a service, adding a feature flag, planning a canary or rollback, renaming or dropping a column, backfilling data, removing or deprecating code, setting up alerts, or planning a deploy order across services.
---

# Shipping changes

Rules for CI, compatibility, releases, publishing, rollout, and watching main. These rules are language-, framework-, and tool-agnostic. Examples are pseudocode, so translate the shape to the project's stack, and let repo conventions decide mechanics. If another workflow skill is active, it owns the steps. Apply these rules inside each step. On conflict between a workflow skill's shipping advice and these rules, these rules win. Say so when you override one.

**One rule: keep main releasable and make every release boring: scripted, re-runnable, verified.** Any commit on main could ship as it is. The only manual parts are the decisions: which commit, and "go". A release that fails halfway runs again without burning a version. Verification reads what users get, not what you meant to ship. Pipelines follow the code rule too: a broken precondition (the version already holds different bytes, the tests didn't run) is a bug, so stop loudly. A network or registry failure is expected, so retry it with bounds or report it.

## Terms
- **Contract:** what users rely on, in two layers. **Shape** is the schema and signatures. **Behavior** is what the system does with a well-formed call. A **promise** is one behavior rule: `"<situation> → <outcome>"`.
- **Break:** a contract change that a caller of the last release can notice. A **declared** break has a breaking changelog entry and a major bump. Any other break is undeclared and fails the build.
- **N-1, N:** the last release and the one being built. The **window** is the range of versions that must work together during a rollout.
- **Frozen commit:** the SHA, resolved from remote main, that a release ships, and nothing else.
- **One-way door:** a step that can't be undone (publish, declared break, re-tag, overwrite, dropping data, force-pushing a shared branch). Stop and ask there. Every other step is a two-way door and runs without asking.

## Load when the task matches
Read the whole file before starting that part of the task:
- Commit messages, splitting commits, branches, PR size and description → [reference/commits-and-prs.md](reference/commits-and-prs.md)
- CI config, test tiers, pinning toolchains or actions, job permissions, flaky tests → [reference/ci.md](reference/ci.md)
- Schema or API changes, breaking-change detection, deprecation, executable specs → [reference/compatibility.md](reference/compatibility.md)
- PR labels by contract impact, spec owners, verdict jobs → [reference/review-routing.md](reference/review-routing.md)
- Post-merge suites, performance trends, scheduled validation, failure tracking, alerts and paging → [reference/watching-main.md](reference/watching-main.md)
- Version bumps, release checklists, cadence, tagging, fixing a bad release → [reference/releases.md](reference/releases.md)
- Build and publish scripts, registries, manifests, release credentials, verifying a publish → [reference/publishing.md](reference/publishing.md)
- Deploying a running service, feature flags, canary, rollback plans, error budgets → [reference/deploys.md](reference/deploys.md)
- Schema migrations, backfills, renaming or dropping fields, removing or deprecating code → [reference/migrations.md](reference/migrations.md)
- Several services, deploy order, version windows, data and event migration → [reference/rollout.md](reference/rollout.md)

## Before finishing
Review the change against this list. Fix each miss and re-check until the list is clean:
- [ ] Every one-way door (publish, declared break, re-tag, overwrite, dropping data, force-push) stops and asks first.
- [ ] Every release step is scripted, checks whether it already ran, and runs again safely.
- [ ] A broken precondition stops loudly. Network and registry failures retry with a bound, then fail clearly.
- [ ] Each tool, dependency, and action is pinned in one place that a laptop and CI both read.
- [ ] Verification reads what users get, not what you meant to ship.
- [ ] Each reference file the task matched was read and applied.
