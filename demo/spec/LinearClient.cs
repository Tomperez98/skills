using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Linear.Spec;

/// <summary>
/// Drives system/server.mjs over stdin/stdout, one JSON line per call. The
/// process keeps its data in a file, so <see cref="RestartAsync"/> can kill it
/// and start another over the same storage.
/// </summary>
public sealed class LinearClient : IDisposable
{
    static readonly string ServerPath = Path.GetFullPath(Path.Combine(
        Path.GetDirectoryName(SourceFile())!, "..", "system", "server.mjs"));

    static string SourceFile([CallerFilePath] string path = "") => path;

    readonly string _dataFile = Path.Combine(Path.GetTempPath(), $"linear-{Guid.NewGuid():N}.json");
    readonly object _write = new();
    readonly Random _rng;
    Process _node = null!;
    ConcurrentDictionary<int, TaskCompletionSource<string>> _pending = new();
    int _nextId;

    /// <summary>Share of calls that end in a timeout, half before sending, half after the reply. 0 = none.</summary>
    public double FaultRate { get; set; }

    public LinearClient(int seed = 0)
    {
        _rng = new Random(seed);
        Start();
    }

    void Start()
    {
        var info = new ProcessStartInfo("node", ServerPath)
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
        };
        info.Environment["LINEAR_DATA"] = _dataFile;
        var node = Process.Start(info)!;
        var pending = new ConcurrentDictionary<int, TaskCompletionSource<string>>();
        (_node, _pending) = (node, pending);
        _ = Task.Run(() => ReadResponses(node, pending));
    }

    // Responses arrive in completion order; match each to its call by id.
    static async Task ReadResponses(Process node, ConcurrentDictionary<int, TaskCompletionSource<string>> pending)
    {
        while (await node.StandardOutput.ReadLineAsync() is { } line)
        {
            var id = JsonDocument.Parse(line).RootElement.GetProperty("id").GetInt32();
            if (pending.TryRemove(id, out var tcs)) tcs.SetResult(line);
        }
        foreach (var tcs in pending.Values)
            tcs.TrySetException(new InvalidOperationException("server.mjs exited"));
    }

    Task<string> Send<TReq>(string op, TReq req)
    {
        var id = Interlocked.Increment(ref _nextId);
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = tcs;
        lock (_write)
        {
            _node.StandardInput.WriteLine(JsonSerializer.Serialize(new { id, op, req }, Json.Options));
            _node.StandardInput.Flush();
        }
        return tcs.Task.WaitAsync(TimeSpan.FromSeconds(10));
    }

    public async Task<ApiResult<TData>> CallAsync<TReq, TData>(string op, TReq req)
    {
        double roll;
        lock (_rng) roll = FaultRate > 0 ? _rng.NextDouble() : 1;

        // Request lost: the server never sees the call.
        if (roll < FaultRate / 2) return ApiResult<TData>.Timeout();

        var line = await Send(op, req);

        // Response lost: the server did the work, the client never hears.
        if (roll < FaultRate) return ApiResult<TData>.Timeout();

        return JsonSerializer.Deserialize<ApiResult<TData>>(line, Json.Options)!;
    }

    public async Task Reset()
    {
        var faults = FaultRate;
        FaultRate = 0;
        await CallAsync<object, object>("reset", new { });
        FaultRate = faults;
    }

    /// <summary>Kill the process (no graceful shutdown) and start a new one over the same data file.</summary>
    public async Task RestartAsync()
    {
        _node.Kill(true);
        await _node.WaitForExitAsync();
        Start();
    }

    public void Dispose()
    {
        _node.Kill(true);
        File.Delete(_dataFile);
    }
}
