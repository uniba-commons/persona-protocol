# persona-kit

Portable anonymous identity for the web: start using an app with **no login**,
carry a per-browser persona, and optionally graft it onto a verified account
(OIDC) later.

Extracted from [another-sgms](https://github.com/uniba/super-good-meetings)
(PRs [#18](https://github.com/uniba/super-good-meetings/pull/18) /
[#19](https://github.com/uniba/super-good-meetings/pull/19)). Two consumers
are targeted from day one, on equal footing:

- **another-sgms** — Rails + GraphQL + Apollo; identity carried by an
  `X-Agent-Id` header on every request
- **my-local-3-hono** — Hono + htmx (server-rendered, no client framework);
  identity carried by an HMAC-signed session cookie, with the agent id as an
  exportable "share key"

another-sgms is the origin, **not** the reference implementation. The kit is
done only when both consumers run on it.

## Status

De-appified (pre-v0). The seed (verbatim copy from another-sgms branch
`sgms-17`) has been made standalone: the Ruby gem builds and its specs run
without Rails, and the TypeScript side builds as three workspace packages
with no runtime dependencies. See
[doc/decisions/0001-de-appification.md](doc/decisions/0001-de-appification.md)
for what was decided (and what is still open). The protocol spec
([doc/protocol.md](doc/protocol.md), draft v0.1) now covers both transports;
conformance fixtures and the consumer PRs are the next deliverables.

## Layout

```
doc/
  protocol.md                 # the normative spec; everything else adapts to it
  consumers.md                # consumer profiles and deviations (informative, ja)
  persona-module-handoff.md   # the handoff: inventory, protocol invariants,
                              # design constraints, open questions, plan (ja)
  auth-removal-plan.md        # design history, copied from another-sgms (ja)
  decisions/                  # decision records (ja)
gems/persona/                 # Ruby gem: seams, OIDC verifier contract,
                              # AccountLink (storage-port based), LinkStore
packages/core/                # TS: agent-id holder, join handshake,
                              # wire-protocol names; no dependencies
packages/apollo/              # TS: Apollo links (X-Agent-Id, NOT_JOINED retry)
packages/cable/               # TS: ActionCable agent_id query param
examples/                     # how a Rails consumer wires the seams and
                              # implements the AccountLink storage port
```

Build & test:

```
cd gems/persona && bundle install && bundle exec rspec   # Ruby
npm install && npm run build                             # TypeScript
```

## Where to start

Read [doc/protocol.md](doc/protocol.md) — the normative spec covering both
transports (header and cookie); language packages are adapters around it.
For background, `doc/persona-module-handoff.md` is the original handoff and
`doc/decisions/` records how its open points were settled.

Publishing target: the `uniba-commons` GitHub org (later; local-only for now).
