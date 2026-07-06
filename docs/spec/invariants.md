# Core invariants

These eight rules hold in every transport profile; the profiles differ only in
how the credential is carried.

### P-1 — Reading is anonymous {#p-1}

Read access is open to browsers that have not joined. Implementations **MUST
NOT** create or demand an identity for read-only use.

### P-2 — Writing is opt-in {#p-2}

A write attempted by a browser that has not joined **MUST** be rejected with the
logical signal `NOT_JOINED`, together with a path into the join flow. How the
signal travels is profile-specific ([H-4](/spec/header-profile#h-4) /
[C-4](/spec/cookie-profile#c-4)); the name is the protocol.

### P-3 — The credential is secret {#p-3}

The credential (an agent_uid, or the session cookie value) **MUST NOT** appear in
URLs, HTML, response bodies, or logs. The only exception is the single moment an
anonymous browser acquires a persona ([H-3](/spec/header-profile#h-3) /
[C-3](/spec/cookie-profile#c-3)).

### P-4 — The server does not issue identity {#p-4}

A persona is self-asserted until verified. In the header profile the browser
generates the agent_uid ([H-1](/spec/header-profile#h-1)). In the cookie profile
the server **MAY** generate it during join, but it **MUST** remain a self-asserted
anchor: it **MUST NOT** be derived from or tied to any verified identity at
creation.

### P-5 — Two trust levels of binding {#p-5}

Agent bindings are self-asserted and secret; account bindings are
provider-verified and exposable. They **MUST NOT** share a single storage or
exposure policy. The persona is the junction: a merge **MUST** move both kinds of
binding along with domain data.

### P-6 — Conflicts resolve in two phases {#p-6}

When a different persona already holds the subject or claim code being claimed,
nothing may change without an explicit confirmation: the first response **MUST**
be a preview, computed without side effects, and the mutation **MUST** only
happen on a confirmed second request.

This rule is the reason persona-protocol exists as a protocol rather than a
convention — see [Claims](/spec/claims) for the table it governs.

### P-7 — Claim codes are single-use and never stored in the clear {#p-7}

A claim code **MUST** be invalidated by its first successful consumption, consumed
atomically (concurrent double-spends **MUST NOT** both succeed), and persisted
only as a digest (e.g. SHA-256). Implementations **SHOULD NOT** offer re-display
or re-issue of an existing code; issuing a fresh one is the supported path.

### P-8 — Identity decisions happen on credentialed requests {#p-8}

Tokens that ride a redirect (OIDC `state`, `link_token`, …) **MUST NOT** finalize
a binding by themselves. The final decision **MUST** happen on a request that
carries the browser's credential — the browser, not the redirect, is the entity.

## Choosing a profile

The profiles differ in **where the credential is available**, not in how much
client scripting an application has:

- **[Header profile](/spec/header-profile)** — the credential lives in
  client-held storage and is attached by client code. Fits API-separated
  clients: SPAs, native mobile apps, CLI tools — anything without (or outside) a
  cookie jar. The server cannot personalize server-rendered HTML on first load.
- **[Cookie profile](/spec/cookie-profile)** — the credential lives in the
  browser's cookie jar and reaches the server on every request automatically,
  including server-side rendering, streaming responses, form posts, WebSocket
  handshakes, and Server-Sent Events. Fits fully server-rendered stacks *and*
  hybrid SSR frameworks with rich clients.

An application **MUST** treat exactly one profile as its source of identity
truth; mixing both invites conflicting credentials.
