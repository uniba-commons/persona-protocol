# Join handshake

Join is the opt-in moment an anonymous browser acquires a persona. In both
profiles it is **propose → confirm**: no persona exists until the user explicitly
commits.

### P-9 — Persona creation is an explicit action {#p-9}

Persona creation **MUST** be an explicit user action. Implementations **MUST
NOT** create personas silently as a side effect of reading or of an error path.

### P-10 — Proposal state stays out of the domain {#p-10}

The server **MAY** propose defaults (nickname, avatar, …) before the commit.
Pre-commit proposal state lives outside the domain data — in client state, or in
a short-lived signed cookie — and **MUST NOT** touch domain records until
confirmed.

### P-11 — Commit is idempotent {#p-11}

On commit, the server creates the agent binding and runs the application's join
side effects. Join **MUST** be idempotent: presenting an already-known agent_uid
resolves to the existing persona rather than erroring or duplicating.

## The two shapes

The handshake looks slightly different per profile, but the propose → confirm
spine is identical.

| Step | Header profile | Cookie profile |
| --- | --- | --- |
| **Trigger** | A write is rejected with `NOT_JOINED`; the client opens its join UI | The visitor takes a join action on a server-rendered page |
| **Propose** | Client generates a candidate agent_uid | Server validates entry (e.g. an invite) and sets a pending cookie |
| **Confirm** | User accepts; client sends the join request | User commits on a confirmation page |
| **After** | Client persists the agent_uid and retries the original write | Server issues the session cookie (`Set-Cookie`) and redirects |
