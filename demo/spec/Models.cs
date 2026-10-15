using System.Text.Json;

namespace Linear.Spec;

public record Team(string Key);
public record Issue(string Id, int Number, string Title, int Priority, string Status, string? Assignee);
public record Archived(string Id);

public record CreateIssueRequest(string Team, string Title, int Priority);
public record SetStatusRequest(string Id, string Status);
public record AssignRequest(string Id, string? Assignee);
public record ListIssuesRequest(string Team, string? Status);

public class ApiResult<T>
{
    public int Status { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };
}
