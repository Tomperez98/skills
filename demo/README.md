# Linear-like demo

A small issue tracker in Node, modelled with the Accordant skill. The
contract is in [CONTRACT.md](CONTRACT.md).

- `system/` — the tracker (`linear.mjs`) and its JSON-lines server.
- `spec/` — the C# spec, generated tests, and a replay of recorded traces.
- `tools/` — `fuzz.mjs` records traffic, `mutate.mjs` plants bugs, and
  `uncovered.mjs` lists lines no test ran.

```sh
cd spec && dotnet test            # needs node and the .NET SDK
node tools/mutate.mjs             # from demo/: every planted bug should die
```
