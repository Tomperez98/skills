// A tiny Linear-like tracker: teams own numbered issues (ENG-1, ENG-2, ...).
export const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"];
const TERMINAL = new Set(["done", "canceled"]);

const ok = (data) => ({ status: 200, data });
const fail = (status, error) => ({ status, error });

export class Linear {
  constructor() {
    this.teams = new Map(); // key -> { counter, issues: Map<id, issue> }
  }

  createTeam({ key }) {
    if (!/^[A-Z]{2,5}$/.test(key)) return fail(400, "invalid team key");
    if (this.teams.has(key)) return fail(409, "team exists");
    this.teams.set(key, { counter: 0, issues: new Map() });
    return ok({ key });
  }

  createIssue({ team, title, priority }) {
    const t = this.teams.get(team);
    if (!t) return fail(404, "team not found");
    if (typeof title !== "string" || title.trim() === "") return fail(400, "title required");
    if (!Number.isInteger(priority) || priority < 0 || priority > 4) return fail(400, "priority 0-4");
    const number = ++t.counter;
    const issue = { id: `${team}-${number}`, number, title, priority, status: "backlog", assignee: null };
    t.issues.set(issue.id, issue);
    return ok({ ...issue });
  }

  #find(id) {
    return this.teams.get(String(id).split("-")[0])?.issues.get(id);
  }

  getIssue({ id }) {
    const issue = this.#find(id);
    return issue ? ok({ ...issue }) : fail(404, "issue not found");
  }

  setStatus({ id, status }) {
    const issue = this.#find(id);
    if (!issue) return fail(404, "issue not found");
    if (!STATUSES.includes(status)) return fail(400, "unknown status");
    if (TERMINAL.has(issue.status) && status !== "todo") {
      return fail(409, "closed issues can only be reopened to todo");
    }
    issue.status = status;
    return ok({ ...issue });
  }

  assign({ id, assignee }) {
    const issue = this.#find(id);
    if (!issue) return fail(404, "issue not found");
    if (assignee !== null && (typeof assignee !== "string" || assignee === "")) return fail(400, "bad assignee");
    issue.assignee = assignee;
    return ok({ ...issue });
  }

  archiveIssue({ id }) {
    const issue = this.#find(id);
    if (!issue) return fail(404, "issue not found");
    this.teams.get(String(id).split("-")[0]).issues.delete(id);
    return ok({ id });
  }

  listIssues({ team, status }) {
    const t = this.teams.get(team);
    if (!t) return fail(404, "team not found");
    if (status !== null && !STATUSES.includes(status)) return fail(400, "unknown status");
    const issues = [...t.issues.values()]
      .filter((i) => status === null || i.status === status)
      .sort((a, b) => a.number - b.number)
      .map((i) => ({ ...i }));
    return ok(issues);
  }
}
