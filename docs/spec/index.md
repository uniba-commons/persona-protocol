# The persona-kit protocol

<div class="spec-version">Version 0.1 · draft</div>

This is the whole of persona-kit. The libraries are adapters around what is
written here; where an implementation and this document disagree, **this
document wins**.

persona-kit specifies **portable anonymous identity** on the web: a visitor
starts using an application with no login, acquires a per-browser persona the
moment they choose to participate, carries that persona across browsers, and
optionally grafts it onto an identity verified by an external provider — without
ever having created an "account".

::: info Conventions
The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
to be interpreted as in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).
:::

## Every requirement has an address

Each normative requirement carries a stable ID, and every ID is a link target.
Deep-link any rule — `#p-6`, `#h-4`, `#c-1` — and it resolves to the exact
paragraph. The [conformance fixtures](/spec/conformance) reference the same IDs,
so a claim in a test maps to a line in the spec.

| Prefix | Scope | Where |
| --- | --- | --- |
| `P-*` | Hold in every transport profile | [Core invariants](/spec/invariants), [Join](/spec/join), [Claims](/spec/claims), [Account linking](/spec/account-linking), [agent_uid](/spec/agent-uid) |
| `H-*` | Header transport profile | [Header profile](/spec/header-profile) |
| `C-*` | Cookie transport profile | [Cookie profile](/spec/cookie-profile) |

## How to read it

1. **[Concepts](/spec/concepts)** — the six words the rest of the spec is built
   from.
2. **[Core invariants](/spec/invariants)** — the eight rules (`P-1`…`P-8`) that
   are true regardless of transport, and how to pick a profile.
3. **[Header profile](/spec/header-profile)** / **[Cookie profile](/spec/cookie-profile)**
   — the two ways to carry the credential.
4. **[Join](/spec/join)**, **[Claims](/spec/claims)**, **[Account linking](/spec/account-linking)**
   — the three flows: acquiring a persona, taking one over, and grafting a
   verified identity.
5. **[agent_uid format](/spec/agent-uid)**, **[Security](/spec/security)**,
   **[Conformance](/spec/conformance)** — the fine print.

The single most load-bearing page is **[Claims](/spec/claims)**: one uniform
decision table that governs recovery codes, migration keys, and OIDC linking
alike, in six rows.
