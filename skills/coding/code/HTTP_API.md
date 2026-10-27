# Design an HTTP API

You're defining the contract between clients you don't control and a server
you do. The goal is a contract that is guessable, safe to retry, and safe to
change: a broken invariant is a 5xx, every expected failure a named 4xx.
Apply the rules in order.

For an in-process interface, use [SHAPE.md](SHAPE.md) instead. When the
protocol, the versioning scheme, or the auth model is the user's call,
ask the user before you write it.

## 1. Pick the protocol from the caller, and default to REST

- **REST** unless a named need says otherwise. A resource over HTTP maps to
  CRUD and database rows, and every proxy, cache, and client library
  already understands it.
- **GraphQL** when several clients need different subsets of the same
  graph and over- or under-fetching is the measured problem. Budget for
  schema design, N+1 batching, and field-level authorization.
- **RPC (gRPC)** for service-to-service calls where the operation is an
  action, latency matters, the client is generated from a schema, or
  streams are needed. Don't expose CRUD resources to browsers this way.

Pick one protocol per boundary. A public REST API and internal gRPC
services are a normal pair; a boundary that speaks two protocols makes
every caller choose.

## 2. Model resources, not actions

A resource is a thing in the system, named by a plural noun. The HTTP
method says what happens to it:

```
GET    /events
GET    /events/{id}
GET    /events/{id}/tickets
POST   /events/{id}/bookings
GET    /bookings/{id}
DELETE /bookings/{id}
```

- **Required relationships go in the path; optional filters go in the
  query.** `/events/{id}/tickets` always scopes to one event;
  `/tickets?event_id=123&section=VIP` works with either filter or neither.
- **An action that changes a resource is still addressed by that
  resource.** `POST /payments`, not `/processPayment`; `POST
  /bookings/{id}/cancellation`, not `/cancelBooking`.
- **One naming convention everywhere.** If one endpoint filters by
  `?status=`, every endpoint uses `status`, the same casing, and the same
  response shape. A caller who has seen one endpoint should be able to
  guess the next.

## 3. Let HTTP carry the meaning

Use the method whose semantics match the operation, and let the status
code carry the outcome:

| Method | Meaning | Safe | Idempotent |
|--------|---------|------|------------|
| GET | read | yes | yes |
| POST | create, or an action | no | no |
| PUT | replace, or create at a known id | no | yes |
| PATCH | partial update | no | only if it sets values |
| DELETE | remove | no | yes |

- **2xx for success**: `200` with a body, `201` with `Location` for a
  created resource, `204` when there is nothing to return.
- **4xx for the caller**: `400` malformed, `401` unauthenticated, `403`
  authenticated but not allowed, `404` absent, `409` conflict or duplicate,
  `429` rate limited.
- **5xx for you**: `500` for an unexpected state, `503` when unavailable.

Put the outcome in the status code, so a failure is never a `200` with an
error in the body: a status code that lies makes every client write a branch
the protocol already defined. A broken
invariant is a 5xx: stop the handler, log it, and return nothing about the
internals.

## 4. Make every request self-contained

Each request carries everything the server needs: the credential, the
parameters, and the payload. No request depends on server memory from an
earlier request. Then any replica can serve any call, a retry can land
anywhere, and scaling is a load-balancer problem instead of a session
problem.

If a client needs to watch progress, make the work a resource
(`GET /jobs/{id}`) with its own state. A server-side conversation held in
one process is both a scaling limit and a lost cause after a restart.

## 5. Make retries safe

GET, PUT, and DELETE replay by contract. A POST that creates something the
user cares about — a payment, booking, or order — cannot: a timeout leaves
the client unsure whether the first call landed, and a blind retry charges
twice.

Require the client to send an `Idempotency-Key` for each logical
operation, and treat it as part of the contract:

```http
POST /events/123/bookings
Idempotency-Key: 8e03978e-740c-4c2e-abd1-52f427d5c177
Content-Type: application/json

{"tickets": [{"section": "VIP", "quantity": 2}]}
```

Store the key with the result and the effect in one transaction. A retry
with the same key returns the stored response; a duplicate still in flight
returns `409`. Scope the key to the caller and endpoint, and expire it
after a stated window. This is CRASHONLY.md rule 4 at the network edge.

## 6. Paginate every collection, and bound it

Every endpoint that returns a collection takes a page size and a cursor,
with a server-side default and a hard maximum. Return the next cursor, or
null at the end:

```
GET /events?limit=10&cursor=cmd9atj3p000007ky19w1dpy2
```

```json
{"events": [], "next_cursor": null}
```

- **Offset (`?offset=&limit=`) when the data is small and stable** and
  clients need to jump to a page. It is the simpler implementation.
- **Cursor when rows are inserted while clients page, or the collection
  is large.** The cursor anchors to the last row, so shifting offsets
  don't duplicate or skip records. The cost is that "page 5" no longer
  means anything.
- **Sort by a unique tiebreaker**, such as id, or pages repeat and drop
  rows at the boundary.
- **Filter and sort with one query vocabulary**, for example
  `?status=upcoming&sort=-date`. Allowlist the field names, and map each
  one to storage yourself.
- **Cap every limit server-side.** A limit that the client controls
  without a cap is a denial-of-service request from a friendly client.

## 7. Return one error envelope

Every failure, on every endpoint, has the same shape:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Section VIP has only 1 seat remaining"
  }
}
```

- **`code` is stable and machine-readable.** Clients branch on it, so
  treat existing codes as part of the contract. Add codes deliberately;
  a client that doesn't know one falls back to the status class.
- **`message` is for people and may change.** Clients branch on `code`
  only.
- **The shape is identical for 4xx and 5xx.** No stack traces, SQL, or
  secrets in either. An unexpected failure is the one generic 5xx code.

## 8. Version the boundary, and break it on purpose

Put the version in the path (`/v1/events`) unless URLs must stay stable,
in which case use a header. Path versioning is easier to see, route, and
test; either way, make the version explicit from the first release.

Within a version, ship additive changes:

- a new endpoint;
- a new optional field in a response;
- a new optional query parameter.

Clients must ignore fields they don't know. Everything else is a breaking
change: renaming, removing, or retyping a field; changing its meaning or
units; adding a required parameter; tightening validation; or adding an
enum value that exhaustive clients can't handle.

A break gets a new version, served alongside the old one until clients
migrate, with a stated sunset. The ship skill's COMPAT.md has the full
compatibility checklist; versioning is where the break is declared, not a
substitute for checking it.

## 9. Secure every boundary by default

- **Authenticate every endpoint** unless it is deliberately public.
  Missing or invalid credentials are `401`.
- **Authorize the specific resource**, not just the login. A customer may
  cancel their own booking and no one else's; that failure is `403`.
  Check ownership or role on the object, server-side.
- **Use API keys for server-to-server clients and short-lived user
  sessions or tokens for people.** TLS everywhere. Credentials travel only
  in headers, and logs redact them.
- **Rate limit** per user, per IP for anonymous callers, and per sensitive
  endpoint (booking attempts, password resets). Return `429` with
  `Retry-After`.
- **Cap the request** — body size and page size — so one call can't spend
  unbounded memory or time. That is rule 6's bound applied to the whole
  request.

For GraphQL, authorize fields as well as the endpoint; for REST, the
resource check belongs in the handler that loads it. Either way, the check
is expected behavior, so it returns a named error, not a panic.

## Done when

- The protocol and resource model match the caller and stay one pattern:
  plural resources, required parents in the path, optional filters in the
  query (rules 1–2).
- Methods, status codes, and retries follow HTTP semantics, and every POST
  with a user-visible effect takes an idempotency key (rules 3–5).
- Every collection is paginated, capped, and filterable and sortable
  through one vocabulary (rule 6).
- Every failure returns one envelope with a stable code: 4xx for the
  caller, 5xx for you, and no internals in either (rule 7).
- The version is explicit, every change is additive or a new version, and
  every endpoint authenticates, authorizes the specific resource, and is
  rate limited (rules 8–9).
