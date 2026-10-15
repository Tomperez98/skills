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

    public ApiResult<TData> Call<TReq, TData>(string op, TReq req)
    {
        _node.StandardInput.WriteLine(JsonSerializer.Serialize(new { op, req }, Json.Options));
        _node.StandardInput.Flush();
        var line = _node.StandardOutput.ReadLine()
            ?? throw new InvalidOperationException($"server.mjs exited during '{op}'");
        return JsonSerializer.Deserialize<ApiResult<TData>>(line, Json.Options)!;
    }

    public void Reset() => Call<object, object>("reset", new { });

    public void Dispose()
    {
        _node.StandardInput.Close();
        _node.WaitForExit(2000);
        if (!_node.HasExited) _node.Kill();
    }
}
