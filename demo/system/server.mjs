// JSON-lines driver: one request per stdin line, one response per stdout line.
//   {"op":"createIssue","req":{...}}  ->  {"status":200,"data":{...}}
// {"op":"reset"} swaps in an empty tracker so tests start from a known state.
import { createInterface } from "node:readline";
import { Linear } from "./linear.mjs";

let linear = new Linear();
const ops = ["createTeam", "createIssue", "getIssue", "setStatus", "assign", "archiveIssue", "listIssues"];

for await (const line of createInterface({ input: process.stdin })) {
  const { op, req } = JSON.parse(line);
  let res;
  if (op === "reset") {
    linear = new Linear();
    res = { status: 200 };
  } else if (ops.includes(op)) {
    res = linear[op](req);
  } else {
    throw new Error(`unknown op ${op}`);
  }
  process.stdout.write(JSON.stringify(res) + "\n");
}
