using Microsoft.Accordant;
using NUnit.Framework;

namespace Linear.Spec;

public class LinearTests
{
    static readonly Spec<AppState> Spec = LinearSpec.Build();

    // At most two issues per team and two teams keeps the space finite, so
    // MaxDepth = -1 explores all of it. Cap sits one past what the inputs need.
    static readonly TestGenerationOptions Gen = new()
    {
        MaxDepth = -1,
        StateConstraint = s => ((AppState)s).Teams.Values.All(t => t.Counter <= 2),
        SimplifyOperationCallNames = false,
        SequentialTestCaseAlgorithm = CyclingWalk(walks: 500, length: 14, seed: 42),
    };

    static InputSet Inputs()
    {
        var team = Spec.GetOperation<string, ApiResult<Team>>("CreateTeam");
        var create = Spec.GetOperation<CreateIssueRequest, ApiResult<Issue>>("CreateIssue");
        var get = Spec.GetOperation<string, ApiResult<Issue>>("GetIssue");
        var status = Spec.GetOperation<SetStatusRequest, ApiResult<Issue>>("SetStatus");
        var assign = Spec.GetOperation<AssignRequest, ApiResult<Issue>>("Assign");
        var archive = Spec.GetOperation<string, ApiResult<Archived>>("ArchiveIssue");
        var list = Spec.GetOperation<ListIssuesRequest, ApiResult<List<Issue>>>("ListIssues");

        return new InputSet
        {
            team.With("ENG", "Create team ENG"),
            team.With("eng", "Create team eng (bad key)"),

            create.With(new("ENG", "Fix login", 1), "Create ENG issue"),
            create.With(new("ENG", "  ", 1), "Create ENG issue, blank title"),
            create.With(new("ENG", "Fix login", 9), "Create ENG issue, priority 9"),
            create.With(new("NOPE", "Fix login", 1), "Create issue in missing team"),

            status.With(new("ENG-1", "done"), "ENG-1 done"),
            status.With(new("ENG-1", "todo"), "ENG-1 todo"),
            status.With(new("ENG-1", "bogus"), "ENG-1 bogus status"),
            status.With(new("ENG-2", "canceled"), "ENG-2 canceled"),
            status.With(new("ENG-9", "todo"), "ENG-9 todo (missing)"),

            assign.With(new("ENG-1", "alice"), "Assign ENG-1 alice"),
            assign.With(new("ENG-1", null), "Unassign ENG-1"),
            assign.With(new("ENG-1", ""), "Assign ENG-1 empty"),
            assign.With(new("ENG-2", "bob"), "Assign ENG-2 bob"),

            archive.With("ENG-1", "Archive ENG-1"),

            get.With("ENG-1", "Get ENG-1"),
            get.With("ENG-2", "Get ENG-2"),
            list.With(new("ENG", null), "List ENG"),
            list.With(new("ENG", "done"), "List ENG done"),
            list.With(new("NOPE", null), "List missing team"),
            list.With(new("ENG", "bogus"), "List ENG bogus filter"),
        };
    }

    // Walks may retake edges, so create → archive → create is generated.
    static SequentialTestCaseAlgorithm CyclingWalk(int walks, int length, int seed) => (ctx, root) =>
    {
        var rng = new Random(seed);
        var cases = new List<SequentialTestCase>();
        for (var w = 0; w < walks; w++)
        {
            var calls = new List<OperationCall>();
            for (var (node, i) = (root, 0); i < length && node.Edges.Count > 0; i++)
            {
                // Most edges are reads and refusals that stay put; lean on the ones
                // that move, or walks never get past the empty state.
                var moving = node.Edges.Where(e => e.Target != node).ToList();
                var pool = moving.Count > 0 && rng.NextDouble() < 0.7 ? moving : node.Edges;
                var edge = pool[rng.Next(pool.Count)];
                var call = ((OperationCall)edge.Metadata).Clone();
                call.Name = $"{call.Name} #{i}";
                calls.Add(call);
                node = edge.Target;
            }
            cases.Add(new SequentialTestCase
            {
                Description = TestCaseGenerator.ConstructDescriptionForSequentialTestCase(calls),
                OperationCalls = calls,
            });
        }
        return cases;
    };

    [Test]
    public void Spec_generates_without_crashing()
    {
        Assert.That(Spec.GenerateTests(new AppState(), Inputs(), Gen), Is.Not.Empty);
    }

    [Test]
    public async Task System_matches_spec()
    {
        using var client = new LinearClient();
        var context = Spec.CreateTestingContext();
        context.Register(client);

        var initial = new AppState();
        var tests = Spec.GenerateTests(initial, Inputs(), Gen);
        var options = new TestExecutionOptions
        {
            StopOnFirstFailure = false,
            BeforeEachAsync = info =>
            {
                info.Context.Get<LinearClient>().Reset();
                return Task.CompletedTask;
            },
        };

        var results = await Spec.RunTests(context, initial, tests, options);
        var failures = results.Where(r => !r.Success).ToList();
        Assert.That(failures, Is.Empty,
            $"{failures.Count}/{results.Count} failed. First: {failures.FirstOrDefault()?.LastFailureMessage} Log: {failures.FirstOrDefault()?.LogFilePath}");
    }
}
