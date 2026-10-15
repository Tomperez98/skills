// JSON-lines driver: one request per stdin line, one response per stdout line.
//   {"id":1,"op":"createIssue","req":{...}}  ->  {"id":1,"status":200,"data":{...}}
// Requests are handled concurrently and answered in completion order, so
// clients match responses by id. {"op":"reset"} wipes the data file and starts empty;
// send it only when nothing else is in flight.
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { Linear } from "./linear.mjs";

// LINEAR_DATA names the file that survives restarts; unset means in-memory.
const file = process.env.LINEAR_DATA;
const options = { exportDelayMs: Number(process.env.EXPORT_DELAY_MS ?? 25) };
let linear = new Linear(file, options);

// LINEAR_TRACE names a JSON-lines log of everything this process did, for
// judging by a spec elsewhere: raw requests and responses, plus the window in
// milliseconds each call was in flight so overlapping calls can be told apart.
//   {"event":"boot"} {"event":"reset"} {"event":"call","op":...,"req":...,"res":...,"start":...,"end":...}
const trace = process.env.LINEAR_TRACE;
const record = (entry) => trace && appendFileSync(trace, JSON.stringify(entry) + "\n");
record({ event: "boot" });
const ops = [
  "createTeam", "createIssue", "getIssue", "setStatus", "assign", "archiveIssue", "listIssues",
  "startExport", "getExport", "cancelExport",
];

async function handle({ op, req }) {
  if (op === "reset") {
    if (file) await rm(file, { force: true });
    linear = new Linear(file, options);
    record({ event: "reset" });
    return { status: 200 };
  }
  if (!ops.includes(op)) throw new Error(`unknown op ${op}`);
  return linear[op](req);
}

for await (const line of createInterface({ input: process.stdin })) {
  const msg = JSON.parse(line);
  const start = performance.now();
  handle(msg).then((res) => {
    if (msg.op !== "reset") record({ event: "call", op: msg.op, req: msg.req, res, start, end: performance.now() });
    process.stdout.write(JSON.stringify({ id: msg.id, ...res }) + "\n");
  });
}
