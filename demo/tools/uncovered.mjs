// Run from demo/: (cd spec && NODE_V8_COVERAGE=/tmp/cov dotnet test), then
// node tools/uncovered.mjs /tmp/cov system/linear.mjs (prints lines never run).
import { readdirSync, readFileSync } from "node:fs";
const [dir, target] = process.argv.slice(2);
const src = readFileSync(target, "utf8");
const hits = new Uint8Array(src.length); // 1 = executed in some run
const zero = new Uint8Array(src.length); // innermost range count 0
for (const f of readdirSync(dir)) {
  const { result } = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  for (const s of result.filter((r) => r.url.endsWith(target.split("/").pop()))) {
    const cnt = new Int32Array(src.length).fill(-1);
    for (const fn of s.functions) for (const r of fn.ranges) cnt.fill(r.count, r.startOffset, r.endOffset); // later = inner
    for (let i = 0; i < src.length; i++) if (cnt[i] > 0) hits[i] = 1; else if (cnt[i] === 0 && !hits[i]) zero[i] = 1;
  }
}
const lines = src.split("\n"); let off = 0;
lines.forEach((l, n) => {
  const t = l.trim();
  const dead = [...l].some((_, i) => zero[off + i] && !hits[off + i] && l[i].trim());
  if (t && dead && !t.startsWith("//")) console.log(`${n + 1}: ${l}`);
  off += l.length + 1;
});
