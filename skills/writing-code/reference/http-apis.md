# HTTP APIs

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

Ask the user when the protocol, versioning scheme, or auth model is their call.
- Default to REST. Use GraphQL when several clients need different subsets and over/under-fetching is measured. Use gRPC for service-to-service actions, generated clients, or streams. One protocol per boundary.
- Required relationships go in the path and optional filters in the query. An action is a resource (`POST /bookings/{id}/cancellation`).
- Every request is self-contained. No server memory between requests. Long work becomes a resource (`GET /jobs/{id}`).
- Prefer cursor pagination when rows are inserted while clients page or the collection is large. Sort by a unique tiebreaker. Use a server default and a hard max limit. Allowlist filter and sort field names and map them to storage yourself.
- Error `code` values are part of the contract. Clients branch on `code`, never `message`, and fall back to the status class for unknown codes. There's one generic 5xx code and no internals.
- Version explicitly from the first release (`/v1` unless URLs must stay stable). Clients ignore unknown fields. Adding an enum value, adding a required param, or changing meaning or units is breaking. Serve the old version alongside the new one with a stated sunset.
- Cap request body size as well as page size.
