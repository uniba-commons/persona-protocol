# The protocol

persona-kit is a protocol first and libraries second. The normative
specification is `doc/protocol.md` in the repository; this page orients you to
its shape. Where this page and the spec disagree, the spec wins.

## Why a protocol

The two reference implementations (Ruby and TypeScript) are deliberately not the
definition of persona-kit — they are adapters around a written spec. That is
what lets a Ruby backend and a TypeScript backend interoperate on the same
personas without drifting, and what lets a third implementation appear later
without reverse-engineering an existing one. Shared conformance fixtures run
against every implementation to keep them honest.

## The core invariants

These hold in every transport profile. Each has a stable ID the spec and the
conformance fixtures reference.

- **P-1 — Reading is anonymous.** No identity is created or demanded for
  read-only use.
- **P-2 — Writing is opt-in.** An un-joined write is rejected with the logical
  signal `NOT_JOINED`, plus a path into the join flow.
- **P-3 — The credential is secret.** It never appears in URLs, HTML, response
  bodies, or logs — except the single moment a browser acquires a persona.
- **P-4 — The server does not issue identity.** A persona is self-asserted until
  verified; the server never mints an identity a user can be trapped inside.
- **P-5 — Two trust levels of binding.** Self-asserted agent bindings (secret)
  and provider-verified account bindings (exposable) are stored and exposed
  differently. The persona is the junction; a merge moves both.
- **P-6 — Conflicts resolve in two phases.** Nothing changes without an explicit
  confirmation: a side-effect-free preview first, the mutation only on confirm.
- **P-7 — Claim codes are single-use and digest-only.** Invalidated on first use,
  consumed atomically, stored only as a digest.
- **P-8 — Identity decisions happen on credentialed requests.** A redirect-borne
  token never finalizes a binding by itself; the browser presenting its
  credential does.

## Transport profiles

The invariants are carried two ways, chosen by where your app needs the
credential:

- **Header profile** — the browser holds the `agent_uid` and sends it in the
  `X-Agent-Id` header (`agent_id` query parameter where headers aren't possible).
  The client generates the key; the server accepts it at join and never echoes
  it back.
- **Cookie profile** — an HMAC-signed session cookie references the persona and
  reaches the server automatically, including during server-side rendering. The
  `agent_uid` never appears on the wire.

An application treats exactly one profile as its source of identity truth.

## The claim decision table

The single most load-bearing part of the spec is the table that governs claims —
redeeming a claim code, or linking a verified identity. It is one uniform
operation over six cases, from "anonymous browser signs up" through "two joined
personas merge on confirm". It is specified once and implemented identically in
both languages, checked by shared fixtures. See the full spec for the table and
its conformance vectors.

## Reading the full spec

The complete normative document — every requirement ID, both transport profiles,
the account-linking round-trip, the agent_uid format rules, and the security
considerations — lives at `doc/protocol.md` in the
[repository](https://github.com/uniba-commons/persona-kit). The design record
alongside it (`doc/decisions/`, `doc/prior-art.md`, `doc/roadmap.md`) explains
how the open questions were settled.
