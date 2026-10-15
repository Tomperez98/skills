// JSON-lines driver: one request per stdin line, one response per stdout line.
//   {"id":1,"op":"createIssue","req":{...}}  ->  {"id":1,"status":200,"data":{...}}
// Requests are handled concurrently and answered in completion order, so
// clients match responses by id. {"op":"reset"} wipes the data file and starts empty;
// send it only when nothing else is in flight.
import { createInterface } from "node:readline";
import { rm } from "node:fs/promises";
import { Linear } from "./linear.mjs";

// LINEAR_DATA names the file that survives restarts; unset means in-memory.
const file = process.env.LINEAR_DATA;
let linear = new Linear(file);
const ops = ["createTeam", "createIssue", "getIssue", "setStatus", "assign", "archiveIssue", "listIssues"];

async function handle({ op, req }) {
  if (op === "reset") {
    if (file) await rm(file, { force: true });
    linear = new Linear(file);
    return { status: 200 };
  }
  if (!ops.includes(op)) throw new Error(`unknown op ${op}`);
  return linear[op](req);
}

for await (const line of createInterface({ input: process.stdin })) {
  const msg = JSON.parse(line);
  handle(msg).then((res) => process.stdout.write(JSON.stringify({ id: msg.id, ...res }) + "\n"));
}
