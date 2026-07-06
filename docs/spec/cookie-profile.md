# Cookie transport profile

For stacks where the server needs the credential at render time: fully
server-rendered applications, and hybrid SSR frameworks that also run rich client
code. The browser never handles the agent_uid; a **signed session cookie**
carries a reference to the persona, and the agent_uid lives server-side as the
persona's anchor. Because cookies ride automatically on same-origin requests, no
additional carriage is needed for WebSocket handshakes or streamed responses.

### C-1 — The session cookie is MAC-protected {#c-1}

The session cookie **MUST** be integrity-protected with a MAC (e.g. HMAC-SHA256)
over a payload containing at least the persona reference and an expiry.
Verification **MUST** use a timing-safe comparison and **MUST** reject expired
payloads.

### C-2 — Cookie attributes {#c-2}

The cookie **MUST** be `HttpOnly`, **MUST** be `Secure` when served over https,
and **SHOULD** be `SameSite=Lax` or stricter. The cookie value is the credential,
so [P-3](/spec/invariants#p-3) applies to it in full.

### C-3 — Issue only at acquisition {#c-3}

[P-3](/spec/invariants#p-3)'s "acquisition moment" takes the form of
`Set-Cookie`: the session cookie is issued only in responses that complete a join
or consume a claim code (**MUST**). The agent_uid itself never appears on the
wire in this profile.

### C-4 — `NOT_JOINED` carriage {#c-4}

Server middleware rejects un-joined writes and routes the browser toward the join
flow (**MUST**). The response shape follows the caller: a redirect for full-page
navigation, a fragment containing a join affordance for partial updates, or a
machine-readable `NOT_JOINED` result for scripted callers (RPC-style endpoints,
server actions). Writes that guests may perform (the join flow itself, claim
consumption, and similar bootstrap actions) **SHOULD** be an explicit allowlist.

### C-5 — Optional per-browser identifier {#c-5}

The session **MAY** additionally carry a per-browser identifier, e.g. to render a
"browsers using this persona" list. Such an identifier is metadata: it **MUST
NOT** be trusted as a credential on its own.

### C-6 — Non-secret join state for rich clients {#c-6}

Rich clients often need to know *whether* the browser has joined (to render join
affordances eagerly) without touching the credential. Applications **MAY** expose
non-secret persona metadata — a joined flag, a display name — through rendered
content or a separate non-credential cookie. The credential cookie itself **MUST**
remain `HttpOnly` regardless.
