using System.Text.Json;
using Microsoft.Accordant;

namespace Linear.Spec;

/// <summary>
/// Judges a trace recorded by system/server.mjs without calling the system.
/// The trace speaks the wire format; this adapts it to the spec's operations
/// and types, then lets spec.Allows decide every response.
/// </summary>
public static class TraceReplay
{
    // Strict, so a field the spec doesn't know is a shape break, not a pass.
    static readonly JsonSerializerOptions Strict = new(Json.Options)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
    };

    // wire operation -> spec operation; string requests arrive wrapped ({"id": ...}).
    static readonly Dictionary<string, (string Spec, string? Wrapped)> Operations = new()
    {
        ["createTeam"] = ("CreateTeam", "key"),
        ["createIssue"] = ("CreateIssue", null),
        ["getIssue"] = ("GetIssue", "id"),
        ["setStatus"] = ("SetStatus", null),
        ["assign"] = ("Assign", null),
        ["archiveIssue"] = ("ArchiveIssue", "id"),
        ["listIssues"] = ("ListIssues", null),
    };

    sealed record Call(IOperation Op, object Request, object Response, double Start, double End, string Text);

    public record Verdict(int Steps, string? Violation);

    /// <summary>A shape break (a trace that doesn't fit the spec's types) throws; a violation is returned.</summary>
    public static Verdict Validate(Spec<AppState> spec, IEnumerable<string> lines)
    {
        var profile = new StateProfile(new AppState());
        var window = new List<Call>();
        var steps = 0;
        var callsSinceReset = false;

        string? Flush()
        {
            // Calls that were in flight together form one group; the rest are sequential.
            foreach (var group in Overlapping(window))
            {
                var (ok, message, next) = group.Count == 1
                    ? spec.Allows(group[0].Op, group[0].Request, group[0].Response, profile)
                    : spec.AllowsConcurrent(profile, group.Select(c => (c.Op, c.Request, c.Response)).ToList());
                steps += group.Count;
                if (!ok)
                    return $"after {steps - group.Count} steps, {string.Join(" || ", group.Select(c => c.Text))}: {message}";
                profile = next;
            }
            window.Clear();
            return null;
        }

        foreach (var line in lines)
        {
            using var doc = JsonDocument.Parse(line);
            var entry = doc.RootElement;
            switch (entry.GetProperty("event").GetString())
            {
                case "call":
                    window.Add(Adapt(spec, entry));
                    callsSinceReset = true;
                    break;
                case "reset":
                    if (Flush() is { } v1) return new Verdict(steps, v1);
                    profile = new StateProfile(new AppState());
                    callsSinceReset = false;
                    break;
                case "boot":
                    if (Flush() is { } v2) return new Verdict(steps, v2);
                    // A boot after calls is a restart; before any call it is just the first start.
                    if (callsSinceReset)
                    {
                        var (ok, message, next) = spec.Allows(spec.GetOperation("Restart"), Unit.Value, Unit.Value, profile);
                        if (!ok) return new Verdict(steps, $"restart: {message}");
                        profile = next;
                        steps++;
                    }
                    break;
                default:
                    throw new InvalidDataException($"unknown trace event in: {line}");
            }
        }
        return new Verdict(steps, Flush());
    }

    static Call Adapt(Spec<AppState> spec, JsonElement entry)
    {
        var wire = entry.GetProperty("op").GetString()!;
        var (name, wrapped) = Operations[wire];
        var op = spec.GetOperation(name);
        var req = entry.GetProperty("req");
        var request = wrapped is null
            ? JsonSerializer.Deserialize(req.GetRawText(), op.RequestType, Strict)!
            : req.GetProperty(wrapped).GetString()!;
        var response = JsonSerializer.Deserialize(entry.GetProperty("res").GetRawText(), op.ResponseType, Strict)!;
        return new Call(op, request, response, entry.GetProperty("start").GetDouble(), entry.GetProperty("end").GetDouble(),
            $"{name}({req.GetRawText()})");
    }

    // Sweep by start time; a call joins the group while it started before the group's latest end.
    static IEnumerable<List<Call>> Overlapping(List<Call> calls)
    {
        var group = new List<Call>();
        var groupEnd = double.NegativeInfinity;
        foreach (var call in calls.OrderBy(c => c.Start))
        {
            if (group.Count > 0 && call.Start >= groupEnd)
            {
                yield return group;
                group = new List<Call>();
            }
            group.Add(call);
            groupEnd = Math.Max(groupEnd, call.End);
        }
        if (group.Count > 0) yield return group;
    }
}
