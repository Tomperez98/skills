// A tiny Linear-like tracker: teams own numbered issues (ENG-1, ENG-2, ...).
// Storage is asynchronous (each read and write yields, like a database), and
// each operation is a plain read-modify-write over it.
export const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"];
const TERMINAL = new Set(["done", "canceled"]);

const ok = (data) => ({ status: 200, data });
const fail = (status, error) => ({ status, error });
const io = () => new Promise((resolve) => setImmediate(resolve));

class Store {
  teams = new Map(); // key -> { counter, issues: Map<id, issue> }

  async team(key) {
    await io();
    return this.teams.get(key);
  }
  async createTeam(key) {
    await io();
    this.teams.set(key, { counter: 0, issues: new Map() });
  }
  async counter(team) {
    await io();
    return team.counter;
  }
  async setCounter(team, n) {
    await io();
    team.counter = n;
  }
  async issue(id) {
    const team = await this.team(String(id).split("-")[0]);
    const issue = team?.issues.get(id);
    return issue && { ...issue };
  }
  async saveIssue(issue) {
    const team = await this.team(issue.id.split("-")[0]);
    await io();
    team.issues.set(issue.id, issue);
  }
  async deleteIssue(id) {
    const team = await this.team(id.split("-")[0]);
    await io();
    team.issues.delete(id);
  }
}

export class Linear {
  store = new Store();
  #tails = new Map(); // team key -> end of its queue of writers

  // Writers to one team run one at a time; readers never wait.
  async #exclusive(team, fn) {
    const prev = this.#tails.get(team) ?? Promise.resolve();
    let release;
    this.#tails.set(team, new Promise((resolve) => (release = resolve)));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  createTeam(args) {
    const { key } = args;
    return this.#exclusive(key, () => this.#createTeam(args));
  }

  async #createTeam({ key }) {
    if (!/^[A-Z]{2,5}$/.test(key)) return fail(400, "invalid team key");
    if (await this.store.team(key)) return fail(409, "team exists");
    await this.store.createTeam(key);
    return ok({ key });
  }

  createIssue(args) {
    const { team, title, priority } = args;
    return this.#exclusive(team, () => this.#createIssue(args));
  }

  async #createIssue({ team, title, priority }) {
    const t = await this.store.team(team);
    if (!t) return fail(404, "team not found");
    if (typeof title !== "string" || title.trim() === "") return fail(400, "title required");
    if (!Number.isInteger(priority) || priority < 0 || priority > 4) return fail(400, "priority 0-4");
    const number = (await this.store.counter(t)) + 1;
    await this.store.setCounter(t, number);
    const issue = { id: `${team}-${number}`, number, title, priority, status: "backlog", assignee: null };
    await this.store.saveIssue(issue);
    return ok(issue);
  }

  async getIssue({ id }) {
    const issue = await this.store.issue(id);
    return issue ? ok(issue) : fail(404, "issue not found");
  }

  setStatus(args) {
    const { id, status } = args;
    return this.#exclusive(String(id).split("-")[0], () => this.#setStatus(args));
  }

  async #setStatus({ id, status }) {
    const issue = await this.store.issue(id);
    if (!issue) return fail(404, "issue not found");
    if (!STATUSES.includes(status)) return fail(400, "unknown status");
    if (TERMINAL.has(issue.status) && status !== "todo") {
      return fail(409, "closed issues can only be reopened to todo");
    }
    issue.status = status;
    await this.store.saveIssue(issue);
    return ok(issue);
  }

  assign(args) {
    const { id, assignee } = args;
    return this.#exclusive(String(id).split("-")[0], () => this.#assign(args));
  }

  async #assign({ id, assignee }) {
    const issue = await this.store.issue(id);
    if (!issue) return fail(404, "issue not found");
    if (assignee !== null && (typeof assignee !== "string" || assignee === "")) return fail(400, "bad assignee");
    issue.assignee = assignee;
    await this.store.saveIssue(issue);
    return ok(issue);
  }

  archiveIssue(args) {
    const { id } = args;
    return this.#exclusive(String(id).split("-")[0], () => this.#archiveIssue(args));
  }

  async #archiveIssue({ id }) {
    if (!(await this.store.issue(id))) return fail(404, "issue not found");
    await this.store.deleteIssue(id);
    return ok({ id });
  }

  async listIssues({ team, status }) {
    const t = await this.store.team(team);
    if (!t) return fail(404, "team not found");
    if (status !== null && !STATUSES.includes(status)) return fail(400, "unknown status");
    await io();
    const issues = [...t.issues.values()]
      .filter((i) => status === null || i.status === status)
      .sort((a, b) => a.number - b.number)
      .map((i) => ({ ...i }));
    return ok(issues);
  }
}
