using Microsoft.Accordant;
using NUnit.Framework;

namespace Linear.Spec;

/// <summary>Exports are background jobs: Start returns pending and the work ends later, or is canceled first.</summary>
public class AsyncTests
{
    static readonly Spec<AppState> Spec = LinearSpec.Build();

    static InputSet Inputs()
    {
        var team = Spec.GetOperation<string, ApiResult<Team>>("CreateTeam");
        var create = Spec.GetOperation<CreateIssueRequest, ApiResult<Issue>>("CreateIssue");
        var start = Spec.GetOperation<string, ApiResult<ExportJob>>("StartExport");
        var restart = Spec.GetOperation<Unit, Unit>("Restart");

        return new InputSet
        {
            team.With("ENG", "Create team ENG"),
            create.With(new("ENG", "Fix login", 1), "Create ENG issue"),
            restart.With("Restart"),
            // One start waits for the job. The other doesn't, so reads and
            // cancels land while it runs (ASYNC.md rule 8).
            start.With("ENG", "Export ENG, wait"),
            start.With("ENG", "Export ENG, don't wait").WithoutPolling(),
            start.With("NOPE", "Export missing team"),
        };
    }

    // Two exports and one issue keep the space finite; the cap sits one past what the inputs need.
    static readonly TestGenerationOptions Gen = new()
    {
        MaxDepth = 6,
        StateConstraint = s =>
        {
            var a = (AppState)s;
            return a.Exports.Count <= 2 && a.Teams.Values.All(t => t.Counter <= 1);
        },
    };

    [Test]
    public void Spec_generates_without_crashing()
    {
        var tests = Spec.GenerateTests(new AppState(), Inputs(), Gen);
        TestContext.Out.WriteLine($"{tests.Count} cases");
        Assert.That(tests, Is.Not.Empty);
    }

    [Test]
    public async Task Exports_match_spec()
    {
        using var client = new LinearClient();
        var context = Spec.CreateTestingContext();
        context.Register(client);

        var initial = new AppState();
        var tests = Spec.GenerateTests(initial, Inputs(), Gen);
        var results = await Spec.RunTests(context, initial, tests, new TestExecutionOptions
        {
            StopOnFirstFailure = false,
            BeforeEachAsync = info => info.Context.Get<LinearClient>().Reset(),
        });

        var failures = results.Select((r, i) => (r, i)).Where(x => !x.r.Success).ToList();
        Assert.That(failures, Is.Empty,
            $"{failures.Count}/{results.Count} failed. First: {failures.FirstOrDefault().r?.LastFailureMessage}\nCase: {(failures.Count > 0 ? tests[failures[0].i].Description : "")}\nLog: {failures.FirstOrDefault().r?.LogFilePath}");
    }
}
