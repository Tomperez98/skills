using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using NUnit.Framework;

namespace Linear.Spec;

/// <summary>The spec as a pure judge of traffic that another program generated.</summary>
public class TraceTests
{
    static readonly Microsoft.Accordant.Spec<AppState> Spec = LinearSpec.Build();

    static string SourceFile([CallerFilePath] string path = "") => path;

    // The workload is plain Node (tools/fuzz.mjs) and knows nothing of the spec.
    static string[] Record(int seed, int rounds = 60)
    {
        var tools = Path.Combine(Path.GetDirectoryName(SourceFile())!, "..", "tools", "fuzz.mjs");
        var trace = Path.Combine(Path.GetTempPath(), $"linear-trace-{Guid.NewGuid():N}.jsonl");
        try
        {
            using var fuzz = Process.Start(new ProcessStartInfo("node", [Path.GetFullPath(tools), trace, $"{seed}", $"{rounds}"]))!;
            Assert.That(fuzz.WaitForExit(120_000), "fuzzer timed out");
            Assert.That(fuzz.ExitCode, Is.EqualTo(0), "fuzzer failed");
            return File.ReadAllLines(trace);
        }
        finally
        {
            File.Delete(trace);
        }
    }

    [TestCase(1)]
    [TestCase(2)]
    [TestCase(3)]
    public void Spec_allows_a_trace_it_did_not_generate(int seed)
    {
        var trace = Record(seed);
        var verdict = TraceReplay.Validate(Spec, trace);

        Assert.That(verdict.Violation, Is.Null);
        // Enough traffic that the pass means something: calls, restarts, overlaps.
        Assert.That(verdict.Steps, Is.GreaterThan(500));
        TestContext.Out.WriteLine($"seed {seed}: {trace.Length} trace lines, {verdict.Steps} steps judged");
    }

    // A judge that accepts everything proves nothing. Corrupt one response at a
    // time; the spec must reject every corrupted trace.
    [Test]
    public void Spec_rejects_a_corrupted_trace()
    {
        var trace = Record(seed: 7, rounds: 20);
        Assert.That(TraceReplay.Validate(Spec, trace).Violation, Is.Null, "uncorrupted trace must pass");

        var rng = new Random(7);
        var calls = trace.Select((line, i) => (line, i)).Where(x => x.line.Contains("\"event\":\"call\"")).ToList();
        var accepted = new List<string>();
        for (var n = 0; n < 40; n++)
        {
            var (line, index) = calls[rng.Next(calls.Count)];
            var entry = JsonNode.Parse(line)!;
            var res = entry["res"]!;
            // An Issue's number moves; anything else gets a status no outcome allows.
            if (res["data"] is JsonObject data && data["number"] is not null) data["number"] = data["number"]!.GetValue<int>() + 100;
            else res["status"] = 418;

            var corrupted = trace.ToArray();
            corrupted[index] = entry.ToJsonString();
            if (TraceReplay.Validate(Spec, corrupted).Violation is null) accepted.Add($"line {index}: {entry.ToJsonString()}");
        }
        Assert.That(accepted, Is.Empty, "corrupted responses the spec accepted");
    }
}
