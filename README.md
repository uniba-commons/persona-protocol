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
for what was decided (and what is still open). The protocol spec (draft v0.1,
in `docs/spec/`) covers both transports and is backed by cross-language
conformance fixtures; the consumer PRs are the next deliverable.

## Layout

```
docs/                         # VitePress site (en): the normative spec, split
  spec/                       #   into navigable chapters — the main content
  {why,how-it-works,comparison,get-started}.md  # narrative intro & positioning
doc/                         # internal design record (ja)
  consumers.md                # consumer profiles, incl. a fictional third
                              # consumer used to stress the design
  prior-art.md                # prior-art survey & positioning; naming risks
  roadmap.md                  # phases; consumers gain features by updating
  persona-module-handoff.md   # the handoff: inventory, invariants, plan
  auth-removal-plan.md        # design history, copied from another-sgms
  protocol.md                 # stub → points at docs/spec/ (spec moved there)
  decisions/                  # decision records
conformance/                  # shared cross-language test vectors (§10 of
                              # the spec); run by both implementations
gems/persona/                 # Ruby gem: seams, OIDC provider registry +
                              # verifier (PKCE + JWKS, uniba/auth preset),
                              # AccountLink (storage-port based), LinkStore,
                              # ClaimCode
packages/core/                # TS: agent-id holder, join handshake,
                              # wire-protocol names; no dependencies
packages/server-core/         # TS: cookie-profile server core — session
                              # tokens, claim codes, claim decision table,
                              # OIDC provider registry + link-store round-trip,
                              # OIDC verifier (PKCE + JWKS) + uniba/auth preset
packages/hono/                # TS: Hono adapter (cookie profile) — session /
                              # pending cookies, persona middleware, gating
packages/apollo/              # TS: Apollo links (X-Agent-Id, NOT_JOINED retry)
packages/cable/               # TS: ActionCable agent_id query param
examples/                     # how a Rails consumer wires the seams and
                              # implements the AccountLink storage port
```

Build & test (both suites include the shared conformance vectors):

```
cd gems/persona && bundle install && bundle exec rspec   # Ruby
npm install && npm test                                  # TypeScript
npm run docs:dev                                         # docs site (local)
```

## Where to start

Read the spec in `docs/spec/` (run `npm run docs:dev`) — the normative source
covering both transports (header and cookie); language packages are adapters
around it. For background, `doc/persona-module-handoff.md` is the original
handoff and `doc/decisions/` records how its open points were settled.

Publishing target: the `uniba-commons` GitHub org (later; local-only for now).
