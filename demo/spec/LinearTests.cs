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
            team.With("A", "Create team A (1 letter)"),
            team.With("ABCDE", "Create team ABCDE (5 letters)"),
            team.With("ABCDEF", "Create team ABCDEF (6 letters)"),

            create.With(new("ENG", "Fix login", 1), "Create ENG issue"),
            create.With(new("ENG", "  ", 1), "Create ENG issue, blank title"),
            create.With(new("ENG", "Fix login", 0), "Create ENG issue, priority 0"),
            create.With(new("ENG", "Fix login", 4), "Create ENG issue, priority 4"),
            create.With(new("ENG", "Fix login", 5), "Create ENG issue, priority 5"),
            create.With(new("ENG", "Fix login", -1), "Create ENG issue, priority -1"),
            create.With(new("ENG", "Fix login", 1.5), "Create ENG issue, priority 1.5"),
            create.With(new("NOPE", "Fix login", 1), "Create issue in missing team"),

            status.With(new("ENG-1", "done"), "ENG-1 done"),
            status.With(new("ENG-1", "todo"), "ENG-1 todo"),
            status.With(new("ENG-1", "backlog"), "ENG-1 backlog"),
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
    public void State_space_is_finite()
    {
        var dot = Spec.VisualizeStateSpace(new AppState(), Inputs(), Gen);
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, "graph.dot");
        File.WriteAllText(path, dot);
        var nodes = System.Text.RegularExpressions.Regex.Matches(dot, @"^\s*\S+\s*\[", System.Text.RegularExpressions.RegexOptions.Multiline).Count;
        var edges = System.Text.RegularExpressions.Regex.Matches(dot, "->").Count;
        TestContext.Out.WriteLine($"graph: ~{nodes} node lines, {edges} edges, {path}");
    }

    [Test]
    public void Spec_generates_without_crashing()
    {
        Assert.That(Spec.GenerateTests(new AppState(), Inputs(), Gen), Is.Not.Empty);
    }

    static async Task<List<(bool Ok, string? Message, string? Log)>> Run(TestGenerationOptions gen)
    {
        using var client = new LinearClient();
        var context = Spec.CreateTestingContext();
        context.Register(client);

        var initial = new AppState();
        var tests = Spec.GenerateTests(initial, Inputs(), gen);
        var options = new TestExecutionOptions
        {
            StopOnFirstFailure = false,
            BeforeEachAsync = info => info.Context.Get<LinearClient>().Reset(),
        };
        var results = await Spec.RunTests(context, initial, tests, options);
        return results.Select(r => (r.Success, (string?)r.LastFailureMessage, (string?)r.LogFilePath)).ToList();
    }

    static void AssertAllPassed(List<(bool Ok, string? Message, string? Log)> results)
    {
        var failures = results.Where(r => !r.Ok).ToList();
        Assert.That(failures, Is.Empty,
            $"{failures.Count}/{results.Count} failed. First: {failures.FirstOrDefault().Message} Log: {failures.FirstOrDefault().Log}");
    }

    [Test]
    public async Task System_matches_spec() => AssertAllPassed(await Run(Gen));

    // Each swarm switches a random third of the inputs off, so walks that
    // would be derailed by reads and refusals go deep (e.g. two issues, both
    // closed, one archived) instead.
    [TestCase(1)]
    [TestCase(2)]
    [TestCase(3)]
    [TestCase(4)]
    [TestCase(5)]
    [TestCase(6)]
    public async Task System_matches_spec_swarm(int seed)
    {
        var rng = new Random(seed);
        var off = Inputs().Select(i => i.Name).Where(_ => rng.NextDouble() < 0.33).ToHashSet();
        var gen = new TestGenerationOptions
        {
            MaxDepth = -1,
            StateConstraint = Gen.StateConstraint,
            SimplifyOperationCallNames = false,
            ShouldApply = (input, _) => !off.Contains(input.Name),
            SequentialTestCaseAlgorithm = CyclingWalk(walks: 200, length: 20, seed: seed),
        };
        AssertAllPassed(await Run(gen));
    }

    // Few inputs that contend for the same issue; each also races a copy of
    // itself. Two creates must not share a number, two closes can't both win.
    static InputSet ConcurrentInputs()
    {
        var team = Spec.GetOperation<string, ApiResult<Team>>("CreateTeam");
        var create = Spec.GetOperation<CreateIssueRequest, ApiResult<Issue>>("CreateIssue");
        var status = Spec.GetOperation<SetStatusRequest, ApiResult<Issue>>("SetStatus");
        var assign = Spec.GetOperation<AssignRequest, ApiResult<Issue>>("Assign");
        var archive = Spec.GetOperation<string, ApiResult<Archived>>("ArchiveIssue");
        var list = Spec.GetOperation<ListIssuesRequest, ApiResult<List<Issue>>>("ListIssues");

        return new InputSet
        {
            team.With("ENG", "Create team ENG"),
            create.With(new("ENG", "Fix login", 1), "Create ENG issue"),
            status.With(new("ENG-1", "done"), "ENG-1 done"),
            status.With(new("ENG-1", "canceled"), "ENG-1 canceled"),
            assign.With(new("ENG-1", "alice"), "Assign ENG-1 alice"),
            archive.With("ENG-1", "Archive ENG-1"),
            list.With(new("ENG", null), "List ENG"),
        };
    }

    // Every case ends in a read of everything, since a lost update where all
    // racers get 200 shows only in the state afterwards.
    static TestGenerationOptions ConcurrentGen(InputSet inputs)
    {
        var concurrent = ConcurrentTestCaseAlgorithms.CreateDefaultConcurrentTestCaseGenerator(maxConcurrencyLevel: 3);
        return new TestGenerationOptions
        {
            MaxDepth = 4,
            StateConstraint = s => ((AppState)s).Teams.Values.All(t => t.Counter <= 2),
            ConcurrentTestCaseAlgorithm = (ctx, root) => concurrent(ctx, root).Select(tc =>
            {
                tc.Segments.Add(new TestCaseSegment(new OperationCall("List ENG (after)", inputs["List ENG"])));
                tc.Description = TestCaseGenerator.ConstructDescriptionForConcurrentTestCase(tc.Segments);
                return tc;
            }).ToList(),
        };
    }

    // One green run isn't proof (CONCURRENCY.md rule 7): repeat.
    [TestCase(1)]
    [TestCase(2)]
    [TestCase(3)]
    public async Task System_is_linearizable(int run)
    {
        var inputs = ConcurrentInputs();
        using var client = new LinearClient();
        var context = Spec.CreateTestingContext();
        context.Register(client);

        var initial = new AppState();
        var tests = Spec.GenerateConcurrentTests(initial, inputs, ConcurrentGen(inputs));
        TestContext.Out.WriteLine($"run {run}: {tests.Count} concurrent cases");
        var options = new TestExecutionOptions
        {
            StopOnFirstFailure = false,
            BeforeEachAsync = info => info.Context.Get<LinearClient>().Reset(),
        };
        var results = await Spec.RunTests(context, initial, tests, options);
        var failed = results.Select((r, i) => (r, i)).Where(x => !x.r.Success).ToList();
        Assert.That(failed, Is.Empty,
            $"{failed.Count}/{results.Count} failed. First: {failed.FirstOrDefault().r?.LastFailureMessage}\nCase: {(failed.Count > 0 ? tests[failed[0].i].Description : "")}\nLog: {failed.FirstOrDefault().r?.LogFilePath}");
    }

    // The races the concurrent suite found, each as its own case. A manual
    // case can't repeat a label, so every racer is a separate input.
    [TestCase("two creates share a number",
        new[] { "Create team ENG" }, new[] { "Create ENG issue", "Create ENG issue B" })]
    [TestCase("two teams with one key",
        new string[0], new[] { "Create team ENG", "Create team ENG B" })]
    [TestCase("a closed issue closed twice",
        new[] { "Create team ENG", "Create ENG issue" }, new[] { "ENG-1 done", "ENG-1 done B" })]
    [TestCase("an issue archived twice",
        new[] { "Create team ENG", "Create ENG issue" }, new[] { "Archive ENG-1", "Archive ENG-1 B" })]
    public async Task Pinned_race_stays_fixed(string race, string[] prefix, string[] racers)
    {
        var team = Spec.GetOperation<string, ApiResult<Team>>("CreateTeam");
        var create = Spec.GetOperation<CreateIssueRequest, ApiResult<Issue>>("CreateIssue");
        var status = Spec.GetOperation<SetStatusRequest, ApiResult<Issue>>("SetStatus");
        var archive = Spec.GetOperation<string, ApiResult<Archived>>("ArchiveIssue");
        var inputs = ConcurrentInputs();
        inputs.Add(team.With("ENG", "Create team ENG B"));
        inputs.Add(create.With(new("ENG", "Fix login", 1), "Create ENG issue B"));
        inputs.Add(status.With(new("ENG-1", "done"), "ENG-1 done B"));
        inputs.Add(archive.With("ENG-1", "Archive ENG-1 B"));

        using var client = new LinearClient();
        var context = Spec.CreateTestingContext();
        context.Register(client);
        var initial = new AppState();
        var options = new TestExecutionOptions
        {
            StopOnFirstFailure = false,
            BeforeEachAsync = info => info.Context.Get<LinearClient>().Reset(),
        };

        // One manual case is one interleaving per run, so repeat it.
        for (var i = 0; i < 25; i++)
        {
            var test = TestCaseGenerator.CreateManualConcurrentTestCase(context, inputs, prefix, racers);
            var results = await Spec.RunTests(context, initial, [test], options);
            Assert.That(results.All(r => r.Success), $"{race} (run {i}): {results.FirstOrDefault(r => !r.Success)?.LastFailureMessage}");
        }
    }
}
