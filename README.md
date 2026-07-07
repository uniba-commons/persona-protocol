# persona-protocol

Portable anonymous identity for the web — **a protocol you run, not a service
you rent.** Start using an app with **no login**, carry a per-browser persona,
and optionally graft it onto a verified account (OIDC) later.

The normative specification lives in [`docs/spec/`](docs/spec/) and is backed by
cross-language **conformance vectors** every implementation must pass. Reference
libraries ship for TypeScript and Ruby.

## Two transport profiles

persona-protocol carries the browser's identity one of two ways; an application
picks exactly one as its source of identity truth:

- **Header profile** — the browser holds the agent id and attaches it as an
  `X-Agent-Id` header. Fits API-separated clients: SPAs, native apps, CLIs.
- **Cookie profile** — an HMAC-signed session cookie carries a reference to the
  persona, available at render time. Fits server-rendered and hybrid stacks.

## Install

```sh
# npm — the base plus the adapter for your stack
npm install @uniba-commons/persona-core @uniba-commons/persona-hono

# Ruby
bundle add persona-protocol
```

Or adopt the conformance vectors as tests against your own implementation, with
no runtime dependency: `npm install -D @uniba-commons/persona-conformance`.

## Layout

```
docs/                  # the normative spec (VitePress site): spec/ chapters + intro
conformance/           # cross-language conformance vectors (data only)
gems/persona/          # Ruby gem: seams, OIDC provider registry + verifier,
                       # account-link decision logic, single-use claim codes
packages/core/         # TS: agent-id holder, join handshake, wire names
packages/server-core/  # TS: cookie-profile session tokens, claim codes, claim
                       # decision table, OIDC verifier + provider registry
packages/hono/         # TS: Hono adapter (cookie profile)
packages/apollo/       # TS: Apollo links (X-Agent-Id, NOT_JOINED retry)
packages/cable/        # TS: ActionCable agent_id query param
examples/              # how a consumer wires the seams and the storage port
```

## Build & test

```
npm install && npm test                                  # TypeScript
cd gems/persona && bundle install && bundle exec rspec   # Ruby
npm run docs:dev                                          # spec site (local)
```

Both suites run the shared conformance vectors, so the TypeScript and Ruby sides
cannot drift from the wire contract.

## Adopt it

The highest-value first step needs no dependency: adopt the
[conformance vectors](conformance/) as tests against your **own** implementation
— they freeze the wire format so your codec can't drift from another's. Climb
from there only as features earn it: a durable browser key, a verified account
via OIDC, then linking across apps. Reading stays anonymous throughout, and the
browser stays the entity.

Start with the spec: [`docs/spec/`](docs/spec/).

## License

[MIT](LICENSE) © UNIBA COMMONS Authors.
