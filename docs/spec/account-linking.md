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

## Revocation

Linking is reversible. Revoking removes **one binding**; it never deletes the
persona and it is never a merge. Two different things can be revoked, and
conflating them is the common implementation mistake:

| Revoking | Removes | Effect on the acting browser |
| --- | --- | --- |
| an **account binding** | one `(provider, subject)` attachment | none — the browser stays joined |
| an **agent binding** | one browser's access to the persona | if it is the acting browser, its stored credential is discarded |

### P-20 — Revocation is credentialed and self-directed {#p-20}

A binding **MUST** only be revoked by a credentialed request
([P-8](/spec/invariants#p-8)) from the persona that holds it. A browser **MUST
NOT** be able to revoke a binding of a persona it does not resolve to:
revocation is never a path to affect another persona.

### P-21 — Revocation frees the subject {#p-21}

Once an account binding is revoked, its `(provider, subject)` pair **MUST**
resolve to no holder ([P-13a](/spec/claims#p-13a)). Linking the same pair again
therefore enters the [claim table](/spec/claims) with no holder — row 1 or row 4,
a fresh bind — and **MUST NOT** be treated as a conflict. Implementations **MUST
NOT** keep a residue that leaves the subject resolving to the revoked binding.

### P-22 — Confirm before the last verified binding goes {#p-22}

Revoking a persona's **last** account binding leaves it reachable only through
self-asserted agent bindings ([P-5](/spec/invariants#p-5)). That case **MUST** be
a two-step operation: the first response is a preview, computed without side
effects, and the removal happens only on a confirmed second request. Revoking a
binding that is not the last **MAY** be single-step.

Whether a binding is the last one can change between the two steps — another
browser may link or revoke in between. Implementations **SHOULD** re-evaluate at
confirm time and fall back to a fresh preview if the answer differs, as
[P-12](/spec/claims#p-12) requires of merges.

This is the same shape as [P-6](/spec/invariants#p-6) for a different reason:
P-6 protects against resolving a conflict in one step, P-22 against discarding
the last recoverable route in one step.

The trigger is deliberately coarse. "The last account binding" is not the same
question as "no recovery route remains" — a persona holding an unconsumed claim
code still has one — but it over-triggers rather than under-triggers, and it is
answerable from the binding list the caller already has, without reaching into
claim-code state. What keeps the coarseness from misinforming the person is what
the preview must contain.

### P-22a — The preview states what remains {#p-22a}

The preview **MUST** state the recovery routes that will survive the removal:
any claim code still outstanding, and the browsers holding an agent binding.
Where no unconsumed claim code remains, the flow **SHOULD** offer to issue one
([P-7](/spec/invariants#p-7)) before completing. Where one does remain, the
persona is not being stranded, and the preview **MUST NOT** say otherwise.

### P-23 — Revoking a browser clears that browser's credential {#p-23}

When the revoked agent binding belongs to the acting browser, that browser's
stored credential **MUST** be discarded, so its subsequent requests are anonymous
([P-1](/spec/invariants#p-1)). Which side does the discarding follows the
profile: in the [header profile](/spec/header-profile#h-1) the client clears the
persisted agent_uid, since the server cannot; in the
[cookie profile](/spec/cookie-profile#c-1) the server clears the session cookie
in the revocation response. Revoking an **account** binding **MUST NOT** clear
it: the browser's own binding is untouched and it stays joined.

A persona **MAY** end up with no bindings of either kind. It is then unreachable
rather than deleted; a deployment **SHOULD** say so before performing the last
revocation, and **MAY** reap such personas on its own schedule.

## The operation surface

Everything above describes moves an application must expose somehow. The
transport is the application's — GraphQL mutations, REST endpoints, form posts —
but the moves themselves are protocol-shaped, the way `NOT_JOINED` is: a client
written against one deployment should recognise them in another.

### P-24 — Four named moves {#p-24}

An implementation offering account linking **MUST** expose these four moves, and
**SHOULD** name them recognisably after the protocol rather than after its own
domain:

| Move | Does | Returns |
| --- | --- | --- |
| **begin** | issues `state`, returns the provider's authorize URL | the authorize URL |
| **complete** | consumes `link_token`, runs the [claim table](/spec/claims) | the linked persona, or a merge preview ([P-6](/spec/invariants#p-6)) |
| **revoke** | removes one binding | the removal, or a preview ([P-22](#p-22)) |
| **list** | reads the persona's account bindings | provider and subject per binding, never a credential ([P-3](/spec/invariants#p-3)) |

**list** is not decoration. A persona **MAY** hold any number of account
bindings ([P-13a](/spec/claims#p-13a)), so an interface that shows one binding
and a single revoke control is already wrong for the second one. Every move
except **begin** operates on a persona and therefore requires a credentialed
request ([P-8](/spec/invariants#p-8)).

### P-25 — Canonical error codes for the link flow {#p-25}

The states below are protocol states, not application errors, and **MUST** be
signalled with these names. How a name travels is transport-specific, exactly as
for `NOT_JOINED` ([H-4](/spec/header-profile#h-4) / [C-4](/spec/cookie-profile#c-4)).

| Code | Raised when |
| --- | --- |
| `ACCOUNT_LINKING_DISABLED` | the deployment has linking switched off, or no provider is registered — the capability can never succeed here |
| `INVALID_ACCOUNT_LINK` | the round-trip token (`state` or `link_token`) is unknown, already consumed, or expired ([P-15](#p-15)) |
| `BINDING_NOT_FOUND` | the binding named for revocation is absent, **or** belongs to another persona |

That last row is deliberate. Distinguishing "no such binding" from "not yours"
would let a caller probe for bindings held by other personas, which
[P-20](#p-20) exists to prevent; the two cases **MUST** be indistinguishable to
the caller.
