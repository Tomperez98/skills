using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Linear.Spec;

/// <summary>Drives system/server.mjs over stdin/stdout, one JSON line per call.</summary>
public sealed class LinearClient : IDisposable
{
    static readonly string ServerPath = Path.GetFullPath(Path.Combine(
        Path.GetDirectoryName(SourceFile())!, "..", "system", "server.mjs"));

    static string SourceFile([CallerFilePath] string path = "") => path;

    readonly Process _node = Process.Start(new ProcessStartInfo("node", ServerPath)
    {
        RedirectStandardInput = true,
        RedirectStandardOutput = true,
    })!;

    readonly ConcurrentDictionary<int, TaskCompletionSource<string>> _pending = new();
    readonly object _write = new();
    int _nextId;

    public LinearClient() => _ = Task.Run(ReadResponses);

    // Responses arrive in completion order; match each to its call by id.
    async Task ReadResponses()
    {
        while (await _node.StandardOutput.ReadLineAsync() is { } line)
        {
            var id = JsonDocument.Parse(line).RootElement.GetProperty("id").GetInt32();
            if (_pending.TryRemove(id, out var tcs)) tcs.SetResult(line);
        }
        foreach (var tcs in _pending.Values)
            tcs.TrySetException(new InvalidOperationException("server.mjs exited"));
    }

    public async Task<ApiResult<TData>> CallAsync<TReq, TData>(string op, TReq req)
    {
        var id = Interlocked.Increment(ref _nextId);
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = tcs;
        lock (_write)
        {
            _node.StandardInput.WriteLine(JsonSerializer.Serialize(new { id, op, req }, Json.Options));
            _node.StandardInput.Flush();
        }
        var line = await tcs.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return JsonSerializer.Deserialize<ApiResult<TData>>(line, Json.Options)!;
    }

    public Task Reset() => CallAsync<object, object>("reset", new { });

    public void Dispose()
    {
        _node.StandardInput.Close();
        _node.WaitForExit(2000);
        if (!_node.HasExited) _node.Kill();
    }
}
