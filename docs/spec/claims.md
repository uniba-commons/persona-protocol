# Claims — taking over a persona

This is the center of the spec. Redeeming a recovery code, importing a migration
key, linking an OIDC account — persona-protocol treats all three as **one uniform
event**:

> A subject — a claim-code digest, or a provider-verified `(provider, subject)`
> pair — designates a **holder**, and the acting browser either adopts that
> holder or binds the subject to itself.

Everything that operation can do fits in six rows.

## The decision table

| # | Browser state | Holder | Action | Resulting credential |
| :-: | --- | --- | --- | --- |
| **1** | anonymous | none | create a fresh persona, bind subject + agent_uid *(sign-up)* | agent_uid returned once ([H-3](/spec/header-profile#h-3)) / `Set-Cookie` ([C-3](/spec/cookie-profile#c-3)) |
| **2** | anonymous | exists | adopt the holder; add this browser's binding *(restore)* | same as above |
| **3** | joined, is the holder | self | idempotent no-op | unchanged |
| **4** | joined | none | bind subject to the acting persona *(link)* | unchanged |
| **5** | joined, ≠ holder, no confirm | exists | **return a merge preview; change nothing** ([P-6](/spec/invariants#p-6)) | unchanged |
| **6** | joined, ≠ holder, confirmed | exists | merge the acting persona into the holder; retire the source | browser now resolves to the holder |

Rows 5 and 6 are the whole reason [P-6](/spec/invariants#p-6) exists: a conflict
never resolves in one step.

### P-12 — Re-resolve the holder at confirm {#p-12}

Between preview (row 5) and confirm (row 6) the holder can change. Implementations
**SHOULD** re-resolve the holder at confirm time and fall back to a fresh preview
if it differs. The merge itself **MUST** run inside a transaction.

### P-13 — Merge direction and scope {#p-13}

A merge moves the source persona's agent bindings, account bindings, and domain
data to the target, then retires the source (**MUST**). The direction is always
*acting persona → holder*; the subject's attachment never moves.

### P-13a — One holder per subject {#p-13a}

A `(provider, subject)` pair **MUST** resolve to at most one persona at any time —
that persona is the holder. A persona **MAY** hold any number of account
bindings, across providers and within one.

## Claim-code lifecycle

Concretizing [P-7](/spec/invariants#p-7):

- Issuing a claim code **MUST** happen on a credentialed request from a browser
  holding the persona.
- Display **SHOULD** be one-shot: shown once at issue time, not retrievable
  later. Users grow the set of browsers by issuing fresh codes.
- Input **SHOULD** be normalized before matching (e.g. uppercase, strip
  non-alphanumerics). Grouped display such as `XXXX-XXXX-…` **MAY** be used.
- Expiry is a deployment choice (**MAY**); single-use ([P-7](/spec/invariants#p-7))
  is the primary defense either way.
