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

Seeded (pre-v0). All code is copied **verbatim** from another-sgms branch
`sgms-17` and is not yet buildable standalone — the Ruby side still assumes
Rails/ActiveSupport and the specs still expect the host app's `rails_helper`.
De-appification is the first work item; see the handoff.

## Layout

```
doc/
  persona-module-handoff.md   # the handoff: inventory, protocol invariants,
                              # design constraints, open questions, plan (ja)
  auth-removal-plan.md        # design history, copied from another-sgms (ja)
gems/persona/                 # Ruby: seams, OIDC verifier contract, AccountLink
packages/persona/src/         # TypeScript: agent-id holder, join orchestrator,
                              # Apollo/ActionCable transport glue
examples/rails-initializer.rb # how a Rails consumer wires the seams
```

## Where to start

Read `doc/persona-module-handoff.md`. Its §3 lists the protocol invariants —
the protocol spec (`doc/protocol.md`, to be written) is the primary
deliverable; language packages are adapters around it.

Publishing target: the `uniba-commons` GitHub org (later; local-only for now).
