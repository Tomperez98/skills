using System.Text.RegularExpressions;
using Microsoft.Accordant;

namespace Linear.Spec;

[State]
public partial class AppState
{
    public Dictionary<string, TeamState> Teams { get; set; } = new();
}

[State]
public partial class TeamState
{
    // Highest number ever issued; archiving never lowers it.
    public int Counter { get; set; }
    public Dictionary<string, IssueState> Issues { get; set; } = new();
}

[State]
public partial class IssueState
{
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Priority { get; set; }
    public string Status { get; set; } = "backlog";
    public string? Assignee { get; set; }
}

public static class LinearSpec
{
    static readonly string[] Statuses = ["backlog", "todo", "in_progress", "done", "canceled"];

    static string TeamOf(string id) => id.Split('-')[0];

    static bool TryFindIssue(AppState s, string id, out IssueState issue)
    {
        issue = null!;
        return s.Teams.TryGetValue(TeamOf(id), out var t) && t.Issues.TryGetValue(id, out issue!);
    }

    static ValidationResult SameIssue(ApiResult<Issue> r, string id, IssueState e)
    {
        if (r.Status != 200 || r.Data is null)
            return ValidationResult.Invalid($"Status: expected 200 with an issue, got {r.Status}");
        var d = r.Data;
        if (d.Id != id) return ValidationResult.Invalid($"Id: expected '{id}', got '{d.Id}'");
        if (d.Number != e.Number) return ValidationResult.Invalid($"Number: expected {e.Number}, got {d.Number}");
        if (d.Title != e.Title) return ValidationResult.Invalid($"Title: expected '{e.Title}', got '{d.Title}'");
        if (d.Priority != e.Priority) return ValidationResult.Invalid($"Priority: expected {e.Priority}, got {d.Priority}");
        if (d.Status != e.Status) return ValidationResult.Invalid($"Status: expected '{e.Status}', got '{d.Status}'");
        if (d.Assignee != e.Assignee) return ValidationResult.Invalid($"Assignee: expected '{e.Assignee}', got '{d.Assignee}'");
        return ValidationResult.Valid();
    }

    // The ValidationResult overload of Expect.That takes no explanation, so fold it in.
    static ExpectedOutcomeBuilder<TResp> Judge<TResp>(string why, Func<TResp, ValidationResult> check) =>
        Expect.That<TResp>(r =>
        {
            var v = check(r);
            return v.IsValid ? v : ValidationResult.Invalid($"{why}: {v.FailureMessage}");
        });

    /// <summary>
    /// When on, a call may also end in a timeout whose effect is unknown, so
    /// every operation lists the extra worlds (FAULTS.md rule 2). Keep it off
    /// while generating tests, on while running them (rule 6).
    /// </summary>
    public static bool IndefiniteFailures { get; set; }

    static ExpectedOutcomeBuilder<TResp> Timeout<TResp>(string why) where TResp : ITimeout =>
        Expect.That<TResp>(r => r.IsTimeout, why);

    // A read or a refusal: leaves the state as it was, even when the reply is lost.
    static ExpectedOutcomes Settled<TResp>(ExpectedOutcomeBuilder<TResp> definite) where TResp : ITimeout =>
        IndefiniteFailures
            ? Expect.OneOf(definite.SameState(), Timeout<TResp>("Timeout: nothing changed").SameState())
            : definite.SameState();

    // A write: a timeout means the request was lost or the reply was.
    static ExpectedOutcomes Writes<TResp>(ExpectedOutcomeBuilder<TResp> ok, Action<AppState> effect) where TResp : ITimeout =>
        IndefiniteFailures
            ? Expect.OneOf(
                ok.ThenState<AppState>(effect),
                Timeout<TResp>("Timeout: request lost").SameState(),
                Timeout<TResp>("Timeout: response lost").ThenState<AppState>(effect))
            : ok.ThenState<AppState>(effect);

    public static Spec<AppState> Build()
    {
        var spec = new Spec<AppState>();
        spec.WithJsonPrinters();

        spec.Operation<string, ApiResult<Team>>("CreateTeam", (key, state) =>
        {
            if (!Regex.IsMatch(key, "^[A-Z]{2,5}$"))
                return Settled(Expect.That<ApiResult<Team>>(r => r.Status == 400,
                           $"Team key '{key}' is not 2-5 capitals → 400"));
            if (state.Teams.ContainsKey(key))
                return Settled(Expect.That<ApiResult<Team>>(r => r.Status == 409,
                           $"Team '{key}' already exists → 409"));
            return Writes(Expect.That<ApiResult<Team>>(r => r.Status == 200 && r.Data?.Key == key,
                       $"New team '{key}' → 200"), next => next.Teams[key] = new TeamState());
        });

        spec.Operation<CreateIssueRequest, ApiResult<Issue>>("CreateIssue", (req, state) =>
        {
            if (!state.Teams.TryGetValue(req.Team, out var team))
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 404,
                           $"Team '{req.Team}' doesn't exist → 404"));
            if (string.IsNullOrWhiteSpace(req.Title) || req.Priority < 0 || req.Priority > 4 || req.Priority != Math.Floor(req.Priority))
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 400,
                           "Blank title, or priority not an integer in 0-4 → 400"));

            var number = team.Counter + 1;
            var id = $"{req.Team}-{number}";
            var expected = new IssueState { Number = number, Title = req.Title, Priority = (int)req.Priority };
            return Writes(Judge<ApiResult<Issue>>($"New issue → 200 as {id}, backlog, unassigned", r => SameIssue(r, id, expected)), next =>
                   {
                       var t = next.Teams[req.Team];
                       t.Counter = number;
                       t.Issues[id] = expected;
                       Invariant.Assert(next.Teams.Values.All(x => x.Issues.Values.All(i => i.Number <= x.Counter)),
                           "No issue number exceeds its team's counter");
                   });
        });

        spec.Operation<string, ApiResult<Issue>>("GetIssue", (id, state) =>
            TryFindIssue(state, id, out var issue)
                ? Settled(Judge<ApiResult<Issue>>($"Issue {id} exists → 200 with its current fields", r => SameIssue(r, id, issue)))
                : Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 404,
                      $"Issue {id} doesn't exist → 404")));

        spec.Operation<SetStatusRequest, ApiResult<Issue>>("SetStatus", (req, state) =>
        {
            if (!TryFindIssue(state, req.Id, out var issue))
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 404,
                           $"Issue {req.Id} doesn't exist → 404"));
            if (!Statuses.Contains(req.Status))
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 400,
                           $"Status '{req.Status}' is unknown → 400"));
            if ((issue.Status is "done" or "canceled") && req.Status != "todo")
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 409,
                           $"{req.Id} is {issue.Status}; only todo reopens it → 409"));

            var expected = new IssueState
            {
                Number = issue.Number, Title = issue.Title, Priority = issue.Priority,
                Status = req.Status, Assignee = issue.Assignee,
            };
            return Writes(Judge<ApiResult<Issue>>($"{req.Id} {issue.Status} → {req.Status}: 200", r => SameIssue(r, req.Id, expected)), next =>
                       next.Teams[TeamOf(req.Id)].Issues[req.Id].Status = req.Status);
        });

        spec.Operation<AssignRequest, ApiResult<Issue>>("Assign", (req, state) =>
        {
            if (!TryFindIssue(state, req.Id, out var issue))
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 404,
                           $"Issue {req.Id} doesn't exist → 404"));
            if (req.Assignee == "")
                return Settled(Expect.That<ApiResult<Issue>>(r => r.Status == 400,
                           "Empty assignee name → 400"));

            var expected = new IssueState
            {
                Number = issue.Number, Title = issue.Title, Priority = issue.Priority,
                Status = issue.Status, Assignee = req.Assignee,
            };
            return Writes(Judge<ApiResult<Issue>>($"{req.Id} assignee → '{req.Assignee ?? "(none)"}': 200", r => SameIssue(r, req.Id, expected)), next =>
                       next.Teams[TeamOf(req.Id)].Issues[req.Id].Assignee = req.Assignee);
        });

        spec.Operation<string, ApiResult<Archived>>("ArchiveIssue", (id, state) =>
        {
            if (!TryFindIssue(state, id, out _))
                return Settled(Expect.That<ApiResult<Archived>>(r => r.Status == 404,
                           $"Issue {id} doesn't exist → 404"));
            return Writes(Expect.That<ApiResult<Archived>>(r => r.Status == 200 && r.Data?.Id == id,
                       $"Archive {id} → 200; its number is never reused"),
                   next => next.Teams[TeamOf(id)].Issues.Remove(id));
        });

        spec.Operation<ListIssuesRequest, ApiResult<List<Issue>>>("ListIssues", (req, state) =>
        {
            if (!state.Teams.TryGetValue(req.Team, out var team))
                return Settled(Expect.That<ApiResult<List<Issue>>>(r => r.Status == 404,
                           $"Team '{req.Team}' doesn't exist → 404"));
            if (req.Status is not null && !Statuses.Contains(req.Status))
                return Settled(Expect.That<ApiResult<List<Issue>>>(r => r.Status == 400,
                           $"Status filter '{req.Status}' is unknown → 400"));

            var expected = team.Issues
                .Where(kv => req.Status is null || kv.Value.Status == req.Status)
                .OrderBy(kv => kv.Value.Number)
                .ToList();
            return Settled(Judge<ApiResult<List<Issue>>>(
                    $"List {req.Team} (filter {req.Status ?? "none"}) → {expected.Count} issues in number order",
                    r =>
                    {
                        if (r.Status != 200 || r.Data is null)
                            return ValidationResult.Invalid($"Status: expected 200 with a list, got {r.Status}");
                        if (r.Data.Count != expected.Count)
                            return ValidationResult.Invalid(
                                $"Count: expected [{string.Join(", ", expected.Select(e => e.Key))}], got [{string.Join(", ", r.Data.Select(d => d.Id))}]");
                        for (var i = 0; i < expected.Count; i++)
                        {
                            var v = SameIssue(new ApiResult<Issue> { Status = 200, Data = r.Data[i] },
                                expected[i].Key, expected[i].Value);
                            if (!v.IsValid) return v;
                        }
                        return ValidationResult.Valid();
                    }));
        });

        // Durable: a restart keeps every acknowledged write, and issue numbers
        // are still never reused afterwards.
        spec.Operation<Unit, Unit>("Restart", (_, state) =>
            Expect.Unit("Restart keeps every acknowledged write and counter").SameState());

        spec.ExecuteWith<LinearClient>()
            .BindAsync<Unit, Unit>("Restart", async (c, _) =>
            {
                await c.RestartAsync();
                return Unit.Value;
            })
            .BindAsync<string, ApiResult<Team>>("CreateTeam", (c, key) => c.CallAsync<object, Team>("createTeam", new { key }))
            .BindAsync<CreateIssueRequest, ApiResult<Issue>>("CreateIssue", (c, r) => c.CallAsync<CreateIssueRequest, Issue>("createIssue", r))
            .BindAsync<string, ApiResult<Issue>>("GetIssue", (c, id) => c.CallAsync<object, Issue>("getIssue", new { id }))
            .BindAsync<SetStatusRequest, ApiResult<Issue>>("SetStatus", (c, r) => c.CallAsync<SetStatusRequest, Issue>("setStatus", r))
            .BindAsync<AssignRequest, ApiResult<Issue>>("Assign", (c, r) => c.CallAsync<AssignRequest, Issue>("assign", r))
            .BindAsync<string, ApiResult<Archived>>("ArchiveIssue", (c, id) => c.CallAsync<object, Archived>("archiveIssue", new { id }))
            .BindAsync<ListIssuesRequest, ApiResult<List<Issue>>>("ListIssues", (c, r) => c.CallAsync<ListIssuesRequest, List<Issue>>("listIssues", r));

        return spec;
    }
}
