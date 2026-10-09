// The baseline every change is compared with: main. This repo has no
// versions, so whatever is on main is what `npx skills add` installs.
// Shared by validate-skills.mjs (citations that changed meaning) and
// contract.mjs (the contract report).

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Run git in the repo. Returns stdout, or null when git fails: the caller
 * decides whether a missing baseline is fatal.
 * @param {string[]} args
 */
export function tryGit(...args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

/**
 * CONTRACT_BASE, else where this branch left main. On main itself that's
 * HEAD, so compare with the commit before it instead. Null when there is no
 * origin/main to compare with (a shallow clone, a fresh fork).
 */
export function baselineCommit() {
  if (process.env.CONTRACT_BASE) return process.env.CONTRACT_BASE;
  const base = tryGit("merge-base", "HEAD", "origin/main")?.trim();
  if (!base) return null;
  const head = tryGit("rev-parse", "HEAD")?.trim();
  return base === head ? tryGit("rev-parse", "HEAD^1")?.trim() ?? null : base;
}
