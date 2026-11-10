# Security

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Treat everything from outside the process as untrusted: request fields, headers, uploaded files, webhooks, third-party responses, fetched pages, and model (LLM) output. Parse it into a validated type at the edge.
- Authorize every request against the specific resource (owner, tenant, role), not only the caller's identity. A valid session plus a guessed ID is the common breach (IDOR). Write that case as a test.
- Build SQL, shell commands, HTML, and file paths only through parameters, argument arrays, or auto-escaping templates. Never concatenate untrusted input into a string something interprets.
- A URL a user influences (webhook target, import, link preview) is an SSRF risk. Allowlist the scheme and host, resolve the name, reject loopback, private, link-local, and reserved addresses among *all* resolved IPs, connect to the IP you checked, and don't follow redirects.
- Before deleting, moving, or overwriting a path derived from input or config, resolve symlinks and require it to sit strictly below an allowlisted root. On refusal, return an error; never fall back to a broader path.
- A system prompt is not a security boundary. Enforce what a model-driven action may do in code: check permissions and validate every tool argument like any other untrusted input.
- Hash passwords with a maintained slow, salted algorithm (argon2id, scrypt, bcrypt). Compare secrets and tokens in constant time.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`, with a bounded lifetime. CORS allows an explicit origin list read from config, never `*` with credentials, and has no dev-default fallback.
- Rate-limit authentication and any endpoint an attacker can enumerate. The limits come from config. Keep the counter in a shared store once more than one instance serves traffic.
- Secrets are config: read once at the edge, required, never logged. A secret that reached a remote (pushed commit, log, ticket, chat) is compromised: rotate it first, then purge it from history.
- Classify each personal-data field when you add it. Each store holding it has a retention period and a deletion path that also reaches caches, backups, and analytics copies.
- Write each abuse case beside its use case ("a member reads another org's invoice") and make the first one a test.
