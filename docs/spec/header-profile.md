# Header transport profile

For stacks whose client can set request headers (typically a script-driven
client talking to an API) and which do not need the credential during
server-side rendering.

The browser holds the agent_uid and attaches it to each request; the server
compares it and never sends it back.

### H-1 — The browser generates the agent_uid {#h-1}

The **browser generates** the agent_uid (**MUST**). The server accepts a
previously-unknown agent_uid at join. This keeps the door open to additive
hardening (e.g. a future signature header derived from client-held key material)
— moving generation to the server would close it.

### H-2 — Wire names: `X-Agent-Id` and `agent_id` {#h-2}

Requests carry the agent_uid in the **`X-Agent-Id`** header (**MUST**).
Transports that cannot set custom headers (e.g. some WebSocket stacks) **MAY**
instead use the connection-URL query parameter **`agent_id`**. Both names are
fixed wire names.

### H-3 — Never echo the agent_uid, except at acquisition {#h-3}

The server **MUST NOT** echo an agent_uid in responses, with one exception: the
moment an anonymous browser acquires a persona (sign-up or restore, see
[Claims](/spec/claims)), the accepted agent_uid **MAY** be returned once so the
client can persist it. Outside that moment, the current persona's agent_uid
**MUST NOT** be exposed through any API type.

### H-4 — `NOT_JOINED` carriage {#h-4}

In GraphQL, an error with `extensions.code = "NOT_JOINED"` (**MUST**); in other
API styles, a 4xx response with a machine-readable code of the same name
(**SHOULD**). Client adapters **SHOULD** react by running the
[join handshake](/spec/join) and, if the user joins, transparently retrying the
original write.

### H-5 — Read paths never generate {#h-5}

The client stores the agent_uid in durable browser storage and **MUST NOT**
generate one on any read path (the client-side face of
[P-1](/spec/invariants#p-1)). A browser that has not joined sends no credential
at all.
