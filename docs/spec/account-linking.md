# Account linking (OIDC)

Account linking creates the verified kind of binding
([P-5](/spec/invariants#p-5)) through a round-trip with an external identity
provider. The capability is optional: a deployment **MUST** be able to disable it
entirely, leaving its endpoints and mutations inert.

A deployment **MAY** register several providers at once; every account binding
records which provider vouched for it ([P-5](/spec/invariants#p-5),
[P-13a](/spec/claims#p-13a)). Implementations **SHOULD** structure provider
support as a **registry behind one contract** — name, authorize-URL construction,
callback verification — so an application gains a new provider (a public IdP, an
organization's own) by updating the library and registering it, not by
reimplementing the flow.

## The round-trip

```
begin ──▶ authorize (IdP) ──▶ callback ──▶ complete
  │             │                 │             │
  │ issue state │ full-page       │ verify;      │ consume link_token on a
  │ store       │ redirect        │ store result │ credentialed request →
  │ pending     │                 │ as link_token│ claim table
```

1. **begin** — a credentialed request naming a registered provider. The server
   issues an opaque `state`, stores `state → (agent_uid, provider)` short-lived,
   and returns that provider's authorize URL.
2. **authorize** — the browser navigates to the IdP and authenticates.
3. **callback** — the server consumes the `state` **once** to recover which
   browser initiated and for which provider, verifies the outcome through that
   provider (contract: `verify(params) -> Identity(provider, subject) | nil`),
   stores the verified result under an opaque `link_token`, and redirects into
   the application UI with only that token.
4. **complete** — a credentialed request presents the `link_token`; the server
   runs the [claim table](/spec/claims). Because a merge preview may require a
   confirm round-trip, reading the `link_token` is non-destructive; it is
   discarded on final success.

### P-14 — Only opaque tokens in URLs {#p-14}

Only opaque, short-lived tokens (`state`, `link_token`) may appear in URLs
(**MUST**). The agent_uid, persona id, and subject **MUST NOT** appear in any URL.

### P-15 — Token single-use and expiry {#p-15}

`state` **MUST** be single-use. `link_token` **MAY** be read repeatedly during the
confirm round-trip but **MUST** expire and **MUST** be discarded on success. Both
**SHOULD** be short-lived (on the order of minutes; e.g. 10 for `state`, 5 for
`link_token`).

### P-16 — The verifier is replaceable behind one contract {#p-16}

The verifier is replaceable behind one contract
(`verify(params) -> Identity | nil`) (**MUST**). A production verifier performs
the code exchange and validates the token against the IdP's published keys —
issuer, audience, expiry, subject, plus any deployment-specific claims (e.g. a
hosted-domain restriction).

::: danger Never deploy the stub
Development stubs that trust the callback parameters **MUST NOT** be deployed to
production.
:::

### P-16a — Bind `state` to the initiating session {#p-16a}

`state` **SHOULD** additionally be bound to the initiating browser session (per
standard OIDC practice), not merely stored server-side, so a pasted callback URL
cannot complete another browser's flow.
