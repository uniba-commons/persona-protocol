# persona-kit protocol

Version 0.1 (draft).

persona-kit is a protocol for **portable anonymous identity** on the web:
visitors start using an application with no login, acquire a per-browser
persona the moment they choose to participate, carry that persona across
browsers, and optionally graft it onto an identity verified by an external
provider — without ever having created an "account".

This document is the normative source. Language packages (the Ruby gem, the
TypeScript packages) are adapters around it; where an implementation and this
document disagree, this document wins.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
are to be interpreted as described in RFC 2119. Requirements carry stable IDs
(`P-*` common, `H-*` header profile, `C-*` cookie profile) which conformance
fixtures (§10) reference.

## 1. Concept model and terminology

- **Persona** — the identity node. A server-side record exists for it, but
  the persona conceptually belongs to the browser(s) holding its credential.
  There is no registration step: a persona comes into existence at join.
- **Browser** — the unit identity is anchored to. One persona is usable from
  many browsers. A browser proves which persona it is acting as by
  presenting a **credential**.
- **Credential** — the secret a browser presents with requests. Its shape is
  profile-specific: the agent_uid itself in the header profile (§3), a
  signed session cookie in the cookie profile (§4).
- **agent_uid** — a self-asserted bearer key tying a browser to a persona.
  An opaque string (§8). Because nothing has verified it, it is a secret.
- **Binding** — an attachment to a persona. Two kinds with different trust
  levels exist (P-5):
  - **agent binding** (agent_uid ↔ persona) — self-asserted; secret.
  - **account binding** (provider, subject ↔ persona) — verified by an
    identity provider; safe to expose.
- **Claim code** — a single-use code that lets another browser (or a future
  self) take over a persona. Deployments name these things like "recovery
  code" or "migration key"; the protocol treats them uniformly (§6).
- **Join** — the opt-in moment an anonymous browser acquires a persona (§5).
- **Holder** — the persona currently bound to a given subject or claim code.

## 2. Core invariants

These hold in every profile; the profiles only differ in carriage.

- **P-1: Reading is anonymous.** Read access is open to browsers that have
  not joined. Implementations MUST NOT create or demand an identity for
  read-only use.
- **P-2: Writing is opt-in.** A write attempted by a browser that has not
  joined MUST be rejected with the logical signal `NOT_JOINED`, together
  with a path into the join flow. How the signal travels is profile-specific
  (H-4 / C-4); the name is the protocol.
- **P-3: The credential is secret.** The credential (an agent_uid, or the
  session cookie value) MUST NOT appear in URLs, HTML, response bodies, or
  logs. The only exception is the single moment an anonymous browser
  acquires a persona (H-3 / C-3).
- **P-4: The server does not issue identity.** A persona is self-asserted
  until verified. In the header profile the browser generates the agent_uid
  (H-1). In the cookie profile the server MAY generate it during join, but
  it MUST remain a self-asserted anchor: it MUST NOT be derived from or tied
  to any verified identity at creation.
- **P-5: Two trust levels of binding.** Agent bindings are self-asserted and
  secret; account bindings are provider-verified and exposable. They MUST
  NOT share a single storage or exposure policy. The persona is the
  junction: a merge MUST move both kinds of binding along with domain data.
- **P-6: Conflicts resolve in two phases.** When a different persona already
  holds the subject or claim code being claimed, nothing may change without
  an explicit confirmation: the first response MUST be a preview, computed
  without side effects, and the mutation MUST only happen on a confirmed
  second request.
- **P-7: Claim codes are single-use and never stored in the clear.** A claim
  code MUST be invalidated by its first successful consumption, consumed
  atomically (concurrent double-spends MUST NOT both succeed), and persisted
  only as a digest (e.g. SHA-256). Implementations SHOULD NOT offer
  re-display or re-issue of an existing code; issuing a fresh one is the
  supported path.
- **P-8: Identity decisions happen on credentialed requests.** Tokens that
  ride a redirect (OIDC `state`, `link_token`, …) MUST NOT finalize a
  binding by themselves. The final decision MUST happen on a request that
  carries the browser's credential — the browser, not the redirect, is the
  entity.

## 3. Header transport profile

For stacks whose client can set request headers (typically a script-driven
client talking to an API).

- **H-1:** The **browser generates** the agent_uid (MUST). The server
  accepts a previously-unknown agent_uid at join. This keeps the door open
  to additive hardening (e.g. a future signature header derived from
  client-held key material) — moving generation to the server would close it.
- **H-2:** Requests carry the agent_uid in the **`X-Agent-Id`** header
  (MUST). Transports that cannot set custom headers (e.g. some WebSocket
  stacks) MAY instead use the connection-URL query parameter **`agent_id`**.
  Both names are fixed wire names.
- **H-3:** The server MUST NOT echo an agent_uid in responses, with one
  exception: the moment an anonymous browser acquires a persona (sign-up or
  restore, §6), the accepted agent_uid MAY be returned once so the client
  can persist it. Outside that moment, the current persona's agent_uid MUST
  NOT be exposed through any API type.
- **H-4:** `NOT_JOINED` carriage: in GraphQL, an error with
  `extensions.code = "NOT_JOINED"` (MUST); in other API styles, a 4xx
  response with a machine-readable code of the same name (SHOULD). Client
  adapters SHOULD react by running the join handshake (§5) and, if the user
  joins, transparently retrying the original write.
- **H-5:** The client stores the agent_uid in durable browser storage and
  MUST NOT generate one on any read path (the client-side face of P-1). A
  browser that has not joined sends no credential at all.

## 4. Cookie transport profile

For server-rendered stacks with little or no client scripting. The browser
never handles the agent_uid; a **signed session cookie** carries a reference
to the persona, and the agent_uid lives server-side as the persona's anchor.

- **C-1:** The session cookie MUST be integrity-protected with a MAC (e.g.
  HMAC-SHA256) over a payload containing at least the persona reference and
  an expiry. Verification MUST use a timing-safe comparison and MUST reject
  expired payloads.
- **C-2:** The cookie MUST be `HttpOnly`, MUST be `Secure` when served over
  https, and SHOULD be `SameSite=Lax` or stricter. The cookie value is the
  credential, so P-3 applies to it in full.
- **C-3:** P-3's "acquisition moment" takes the form of `Set-Cookie`: the
  session cookie is issued only in responses that complete a join or consume
  a claim code (MUST). The agent_uid itself never appears on the wire in
  this profile.
- **C-4:** `NOT_JOINED` carriage: server middleware rejects un-joined writes
  and routes the browser to the join flow (MUST) — in a server-rendered
  application, typically a redirect. Writes that guests may perform (the
  join flow itself, claim consumption, and similar bootstrap actions) SHOULD
  be an explicit allowlist.
- **C-5:** The session MAY additionally carry a per-browser identifier, e.g.
  to render a "browsers using this persona" list. Such an identifier is
  metadata: it MUST NOT be trusted as a credential on its own.

## 5. Join handshake

Join is the opt-in moment an anonymous browser acquires a persona. In both
profiles it is **propose → confirm**: no persona exists until the user
explicitly commits.

- **P-9:** Persona creation MUST be an explicit user action. Implementations
  MUST NOT create personas silently as a side effect of reading or of an
  error path.
- **P-10:** The server MAY propose defaults (nickname, avatar, …) before the
  commit. Pre-commit proposal state lives outside the domain data — in
  client state, or in a short-lived signed cookie — and MUST NOT touch
  domain records until confirmed.
- **P-11:** On commit, the server creates the agent binding and runs the
  application's join side effects. Join MUST be idempotent: presenting an
  already-known agent_uid resolves to the existing persona rather than
  erroring or duplicating.

The typical shapes:

| Step | Header profile | Cookie profile |
|---|---|---|
| Trigger | A write is rejected with `NOT_JOINED`; the client opens its join UI | The visitor takes a join action on a server-rendered page |
| Propose | Client generates a candidate agent_uid | Server validates entry (e.g. an invite) and sets a pending cookie |
| Confirm | User accepts; client sends the join request | User commits on a confirmation page |
| After | Client persists the agent_uid and retries the original write | Server issues the session cookie (`Set-Cookie`) and redirects |

## 6. Claims — taking over a persona

A claim is one uniform event: *a subject — a claim-code digest, or a
provider-verified (provider, subject) pair — designates a holder, and the
acting browser either adopts that holder or binds the subject to itself.*
Recovery codes, migration keys, and OIDC account linking are all instances
of this table:

| # | Browser state | Holder | Action | Resulting credential |
|---|---|---|---|---|
| 1 | anonymous | none | create a fresh persona, bind subject + agent_uid (sign-up) | agent_uid returned once (H-3) / `Set-Cookie` (C-3) |
| 2 | anonymous | exists | adopt the holder; add this browser's binding (restore) | same as above |
| 3 | joined, is the holder | self | idempotent no-op | unchanged |
| 4 | joined | none | bind subject to the acting persona (link) | unchanged |
| 5 | joined, ≠ holder, no confirm | exists | **return a merge preview; change nothing** (P-6) | unchanged |
| 6 | joined, ≠ holder, confirmed | exists | merge the acting persona into the holder; retire the source | browser now resolves to the holder |

- **P-12:** Between preview (row 5) and confirm (row 6) the holder can
  change. Implementations SHOULD re-resolve the holder at confirm time and
  fall back to a fresh preview if it differs. The merge itself MUST run
  inside a transaction.
- **P-13:** A merge moves the source persona's agent bindings, account
  bindings, and domain data to the target, then retires the source (MUST).
  The direction is always *acting persona → holder*; the subject's
  attachment never moves.

Claim-code lifecycle (concretizing P-7):

- Issuing a claim code MUST happen on a credentialed request from a browser
  holding the persona.
- Display SHOULD be one-shot: shown once at issue time, not retrievable
  later. Users grow the set of browsers by issuing fresh codes.
- Input SHOULD be normalized before matching (e.g. uppercase, strip
  non-alphanumerics). Grouped display such as `XXXX-XXXX-…` MAY be used.
- Expiry is a deployment choice (MAY); single-use (P-7) is the primary
  defense either way.

## 7. Account linking (OIDC)

Account linking creates the verified kind of binding (P-5) through a
round-trip with an external identity provider. The capability is optional:
a deployment MUST be able to disable it entirely, leaving its endpoints and
mutations inert.

```
begin ──▶ authorize (IdP) ──▶ callback ──▶ complete
  |             |                 |             |
  | issue state | full-page       | verify;     | consume link_token on a
  | store       | redirect        | store result | credentialed request →
  | pending     |                 | as link_token| claim table (§6)
```

1. **begin** — a credentialed request. The server issues an opaque `state`,
   stores `state → agent_uid` short-lived, and returns the IdP authorize URL.
2. **authorize** — the browser navigates to the IdP and authenticates.
3. **callback** — the server verifies the outcome through its configured
   verifier (contract: `verify(params) -> Identity(provider, subject) | nil`),
   consumes the `state` **once** to recover which browser initiated, stores
   the verified result under an opaque `link_token`, and redirects into the
   application UI with only that token.
4. **complete** — a credentialed request presents the `link_token`; the
   server runs the claim table (§6). Because a merge preview may require a
   confirm round-trip, reading the `link_token` is non-destructive; it is
   discarded on final success.

- **P-14:** Only opaque, short-lived tokens (`state`, `link_token`) may
  appear in URLs (MUST). The agent_uid, persona id, and subject MUST NOT
  appear in any URL.
- **P-15:** `state` MUST be single-use. `link_token` MAY be read repeatedly
  during the confirm round-trip but MUST expire and MUST be discarded on
  success. Both SHOULD be short-lived (on the order of minutes; e.g. 10 for
  `state`, 5 for `link_token`).
- **P-16:** The verifier is replaceable behind one contract
  (`verify(params) -> Identity | nil`) (MUST). A production verifier
  performs the code exchange and validates the token against the IdP's
  published keys — issuer, audience, expiry, subject, plus any
  deployment-specific claims (e.g. a hosted-domain restriction). Development
  stubs that trust the callback parameters MUST NOT be deployed to
  production.
- **P-16a:** `state` SHOULD additionally be bound to the initiating browser
  session (per standard OIDC practice), not merely stored server-side, so a
  pasted callback URL cannot complete another browser's flow.

## 8. agent_uid format

- **P-17:** The agent_uid is an **opaque string** (MUST). Servers use it for
  equality only and MUST NOT interpret its structure. Different deployments
  are free to choose different formats (UUID v4 and 24-character Crockford
  base32 are both in use).
- **P-18:** Generation MUST use a CSPRNG and carry at least 120 bits of
  entropy.
- **P-19:** Acceptance-side validation SHOULD be minimal — printable ASCII,
  no whitespace, a length cap (256 is a reasonable default). Enforcing a
  specific format would constrain future consumers for no security gain.

## 9. Security considerations

- The agent_uid is a bearer secret: leakage equals impersonation. P-3 must
  extend to operational surfaces — access logs in particular. When the
  `agent_id` query parameter is used (H-2), confirm it is excluded from
  request logging.
- Claim codes survive database exposure (digest-only storage) and race
  conditions (atomic consumption) by P-7.
- The cookie profile's MAC key is a server secret. Rotate it with dual-key
  verification (accept old + new during the window) rather than invalidating
  every browser's session at once (SHOULD).
- A merge is destructive (the source persona is retired). Do not let UI
  flatten P-6's preview → confirm into a single reflexive click.
- Anonymous read (P-1) is open to scrapers by design. If that matters,
  defend at layers other than identity (rate limiting, …).

## 10. Conformance

Implementations are assessed against the requirement IDs above. Shared
fixtures (the same vectors run against every language implementation) are
planned under `conformance/`:

1. **Claim decision table** (§6, six rows, plus P-12 holder re-resolution) —
   as `{browser_state, holder_state, confirm} -> {action, echo, merged}`
   vectors against each implementation's claim logic.
2. **Session cookie** (C-1) — sign/verify vectors (key, payload, expiry,
   token), including tampered, expired, and malformed negatives.
3. **Wire names** — `X-Agent-Id` / `agent_id` / `NOT_JOINED` constants agree
   across language packages.
