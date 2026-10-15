using System.Text.Json;

namespace Linear.Spec;

public record Team(string Key);
public record Issue(string Id, int Number, string Title, int Priority, string Status, string? Assignee);
public record Archived(string Id);

public record CreateIssueRequest(string Team, string Title, double Priority);
public record SetStatusRequest(string Id, string Status);
public record AssignRequest(string Id, string? Assignee);
public record ListIssuesRequest(string Team, string? Status);

/// <summary>A response that may mean "no answer": the call might or might not have taken effect.</summary>
public interface ITimeout { bool IsTimeout { get; } }

public class ApiResult<T> : ITimeout
{
    public int Status { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }

    public bool IsTimeout => Status == 0 && Error == "timeout";
    public static ApiResult<T> Timeout() => new() { Status = 0, Error = "timeout" };
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };
}
