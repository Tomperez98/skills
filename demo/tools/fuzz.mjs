// A workload written in the system's own language, with no knowledge of the
// spec: random calls, bursts that overlap, and hard restarts. The server
// records what happened; the C# spec judges the recording afterwards.
//   node tools/fuzz.mjs <trace-file> [seed] [rounds]
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [traceFile, seedArg = "1", roundsArg = "60"] = process.argv.slice(2);
const dataFile = join(tmpdir(), `linear-fuzz-${process.pid}.json`);
const server = new URL("../system/server.mjs", import.meta.url).pathname;

let seed = Number(seedArg);
const rand = () => ((seed = (seed + 0x6d2b79f5) | 0), (((t) => ((t ^ (t >>> 15)) * (1 | t)))(seed) >>> 0) / 4294967296);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

rmSync(traceFile, { force: true });
let child, pending, nextId;
function start() {
  child = spawn("node", [server], {
    env: { ...process.env, LINEAR_DATA: dataFile, LINEAR_TRACE: traceFile },
    stdio: ["pipe", "pipe", "inherit"],
  });
  pending = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const msg = JSON.parse(line);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  });
  nextId = 0;
}
const call = (op, req) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ id, op, req }) + "\n");
  });
async function restart() {
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("exit", resolve));
  start();
}

// Aim at what exists: calls on issues the server has actually handed out
// reach far more code than guessed IDs, and a call raced against itself is
// where double-wins show. The fuzzer sees only responses, never the spec.
const teams = ["ENG", "OPS", "eng", "ABCDE", "ABCDEF"];
const statuses = ["backlog", "todo", "in_progress", "done", "canceled", "bogus"];
let known = [];
const pickId = () => (known.length && rand() < 0.85 ? pick(known) : pick(["ENG-1", "ENG-9", "OPS-1", "NOPE-1"]));
const pickTeam = () => (rand() < 0.8 ? "ENG" : pick(teams));
const randomCall = () =>
  pick([
    ...Array(5).fill(() => ["createIssue", { team: pickTeam(), title: rand() < 0.9 ? "Fix login" : "  ", priority: rand() < 0.85 ? pick([0, 1, 4]) : pick([5, -1, 1.5]) }]),
    ...Array(4).fill(() => ["setStatus", { id: pickId(), status: rand() < 0.9 ? pick(statuses.slice(0, 5)) : "bogus" }]),
    ...Array(2).fill(() => ["assign", { id: pickId(), assignee: pick(["alice", "bob", null, ""]) }]),
    ...Array(2).fill(() => ["archiveIssue", { id: pickId() }]),
    ...Array(2).fill(() => ["getIssue", { id: pickId() }]),
    ...Array(2).fill(() => ["listIssues", { team: pickTeam(), status: pick([null, null, "done", "todo", "bogus"]) }]),
    () => ["createTeam", { key: pick(teams) }],
  ])();
async function send([op, req]) {
  const res = await call(op, req);
  if (op === "createIssue" && res.status === 200) known.push(res.data.id);
  return res;
}
async function burst() {
  const first = randomCall();
  const size = 2 + Math.floor(rand() * 2);
  // Half the bursts race one call against copies of itself.
  const calls = rand() < 0.5 ? Array(size).fill(first) : [first, ...Array.from({ length: size - 1 }, randomCall)];
  await Promise.all(calls.map(send));
}

start();
for (let round = 0; round < Number(roundsArg); round++) {
  await call("reset", {});
  known = [];
  await call("createTeam", { key: "ENG" }); // most rounds need a team to get anywhere
  for (let step = 0; step < 16; step++) {
    const roll = rand();
    if (roll < 0.1) await restart();
    else if (roll < 0.35) await burst();
    else await send(randomCall());
  }
}
child.stdin.end();
rmSync(dataFile, { force: true });
