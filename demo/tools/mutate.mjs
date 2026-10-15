// Run from demo/: node tools/mutate.mjs. Plants one bug at a time in system/linear.mjs
// and reruns the suite; SURVIVED means an input or predicate is missing.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const file = "system/linear.mjs";
const orig = readFileSync(file, "utf8");
const M = [
  ["team key max 4", "{2,5}", "{2,4}"],
  ["team dup allowed", "if (await this.store.team(key))", "if (false)"],
  ["blank title allowed", 'title.trim() === ""', 'title === ""'],
  ["priority max 5", "priority > 4", "priority > 5"],
  ["priority min 1", "priority < 0", "priority < 1"],
  ["priority not-int allowed", "!Number.isInteger(priority) ||", ""],
  ["start status todo", 'status: "backlog"', 'status: "todo"'],
  ["number reuse", "const number = (await this.store.counter(t)) + 1;", "const number = t.issues.size + 1;"],
  ["unknown status allowed (set)", "if (!STATUSES.includes(status)) return fail(400, \"unknown status\");\n    if (TERMINAL", "if (TERMINAL"],
  ["closed accepts backlog", 'status !== "todo") {', 'status !== "todo" && status !== "backlog") {'],
  ["canceled not terminal", '["done", "canceled"]', '["done"]'],
  ["empty assignee allowed", '|| assignee === "")', "|| false)"],
  ["archive keeps issue", "await this.store.deleteIssue(id);", "await this.store.issue(id);"],
  ["archive wrong id", "ok({ id });\n  }\n\n  async listIssues", 'ok({ id: "x" });\n  }\n\n  async listIssues'],
  ["list order reversed", "a.number - b.number", "b.number - a.number"],
  ["list ignores filter", "status === null || i.status === status", "true"],
  ["list bad filter allowed", "if (status !== null && !STATUSES.includes(status)) return fail(400", "if (false) return fail(400"],
  ["assign ignores value", "issue.assignee = assignee;", "issue.assignee = issue.assignee;"],
  ["setStatus ignores value", "issue.status = status;", "issue.status = issue.status;"],
  // Races: drop one team lock at a time. Needs the concurrent tests.
  ["no lock: createTeam", "this.#exclusive(key, () => this.#createTeam(args))", "this.#createTeam(args)"],
  ["no lock: createIssue", "this.#exclusive(team, () => this.#createIssue(args))", "this.#createIssue(args)"],
  ["no lock: setStatus", 'this.#exclusive(String(id).split("-")[0], () => this.#setStatus(args))', "this.#setStatus(args)"],
  ["no lock: assign", 'this.#exclusive(String(id).split("-")[0], () => this.#assign(args))', "this.#assign(args)"],
  ["no lock: archiveIssue", 'this.#exclusive(String(id).split("-")[0], () => this.#archiveIssue(args))', "this.#archiveIssue(args)"],
];
const results = [];
try {
  for (const [name, from, to] of M) {
    if (!orig.includes(from)) { results.push([name, "BAD-PATTERN"]); continue; }
    writeFileSync(file, orig.replace(from, to));
    const r = spawnSync("dotnet", ["test", "--no-restore", "--filter", "FullyQualifiedName~System_matches|FullyQualifiedName~System_is_linearizable|FullyQualifiedName~Pinned_race"], { cwd: "spec", encoding: "utf8" });
    results.push([name, /Failed!/.test(r.stdout) ? "killed" : /Passed!/.test(r.stdout) ? "SURVIVED" : "ERROR"]);
    console.log(name.padEnd(32), results.at(-1)[1]);
  }
} finally {
  writeFileSync(file, orig);
}
