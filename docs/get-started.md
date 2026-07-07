# Get started

::: warning Pre-v0
persona-protocol is under active development. The protocol and the reference
libraries exist and are covered by cross-language conformance tests, but nothing
is published to a package registry yet and the APIs may still move. This page
shows the *shape* of consuming persona-protocol, not a stable install.

**Consuming before publish:** the packages declare their inter-package
dependencies as registry ranges (e.g. `@uniba-commons/persona-server-core:
^0.1.0`), so installing a single package from a local tarball or `file:` dep
hits an npm **E404** on its transitive `@uniba-commons/*` deps — the registry
has nothing to resolve them from yet. Install all of them as top-level `file:`
deps and npm dedupe satisfies the ranges from the local copies. This goes away
once the packages are published.
:::

## What exists today

- A normative [protocol specification](/spec/) covering both transports.
- **Ruby gem** (`gems/persona`) — the seams an app injects, an OIDC provider
  registry, the account-link decision logic behind a storage port, and
  single-use claim codes.
- **TypeScript packages** — `@uniba-commons/persona-core` (the agent-id holder,
  join handshake, and wire-protocol names), `@uniba-commons/persona-server-core`
  (cookie-profile session tokens, claim codes, the claim decision table, the
  OIDC provider registry + link-store round-trip, and a production OIDC verifier
  with a uniba/auth preset),
  `@uniba-commons/persona-hono` (the cookie-profile Hono adapter: session and
  pending cookies, persona-resolution middleware, and `NOT_JOINED` gating),
  plus `@uniba-commons/persona-apollo` and `@uniba-commons/persona-cable`
  header-profile transport adapters.
- Shared **conformance fixtures** that both language implementations run, so the
  Ruby and TypeScript sides can't diverge.

## The shape of it

persona-protocol is wired, not called. You inject your app's concerns into the
generic core and implement a small storage port over your own models.

### Ruby: wire the seams

```ruby
# config/initializers/persona.rb (Rails example)
Rails.application.config.to_prepare do
  Persona.configure do |config|
    # Domain side effects to run when a browser joins.
    config.on_join = ->(user) { user.join_default_team! }

    # The account-link storage port, implemented over your own models.
    config.account_link_store = MyAccountLinkStore.new

    # Register one provider per IdP you link to. The dev stub trusts callback
    # params — never register it in production.
    if Rails.env.development?
      config.register_oidc_provider(Persona::Oidc::StubProvider.new(name: 'example-idp'))
    end
  end
end
```

Account linking then runs through one call, which returns either a result or a
merge preview to confirm:

```ruby
result = Persona::AccountLink.perform(
  identity: identity,          # a verified Persona::Oidc::Identity
  current_user: current_user,  # the acting persona, or nil if anonymous
  agent_uid: agent_uid,        # the browser's self-asserted key
  confirm_merge: false,        # true on the confirmed second pass
)

if result.merge_preview
  # Show the preview; re-call with confirm_merge: true on confirmation.
else
  # Bound. result.agent_uid is non-nil only when the browser must persist a new one.
end
```

### TypeScript: the client side

```ts
import { getAgentId, generateAgentId, setAgentId } from '@uniba-commons/persona-core'

// Reading stays anonymous — never generate an id on a read path.
const id = getAgentId() // null until the visitor joins

// On join, generate, send through your join call, then persist on acceptance.
const fresh = generateAgentId()
// ...server accepts fresh...
setAgentId(fresh)
```

The transport adapters attach that identity for you — an `X-Agent-Id` header via
the Apollo link, or an `agent_id` query parameter for ActionCable — and drive the
`NOT_JOINED` join-and-retry handshake.

### Cookie-profile servers

For server-rendered stacks, `@uniba-commons/persona-server-core` gives you the
signed session codec, claim-code helpers, and the same claim decision table as
the Ruby gem, on Web Crypto only (Node 18+, edge, workers):

```ts
import { createSessionCodec, performAccountLink } from '@uniba-commons/persona-server-core'

const sessions = createSessionCodec({ secret: process.env.SESSION_SECRET! })
const token = await sessions.sign({ sub: personaId, bid: browserId }, 60 * 60 * 24 * 365)
```

On Hono, `@uniba-commons/persona-hono` wires that into the framework — the
session and pending-join cookies, a middleware that resolves the current persona
onto `c.var.persona`, and the `NOT_JOINED` write gate that keeps reads anonymous
while guarding writes:

```ts
import { Hono } from 'hono'
import { createPersonaCookies, personaMiddleware, requireJoined, type PersonaEnv } from '@uniba-commons/persona-hono'

const cookies = createPersonaCookies({ secret: process.env.SESSION_SECRET! })
const app = new Hono<PersonaEnv<User>>()

app.use('*', personaMiddleware({ cookies, resolvePersona: (sub) => findUser(sub) }))
app.use('*', requireJoined({ allow: (c) => c.req.path === '/join', redirectTo: '/welcome' }))

app.get('/', (c) => c.text('anyone can read this'))            // P-1: anonymous read
app.post('/posts', (c) => create(c.get('persona')!))            // gated: needs a persona
```

`requireJoined` gates writes and leaves reads anonymous (P-1). For routes that
are owner-only *on read* — a settings or profile page an anonymous browser must
not see even on GET — attach `requirePersona` instead, which gates every method.
Which routes are private is your policy; the adapter only enforces the gate you
attach.

## Adopting it

persona-protocol is a contract first, so how you take it up depends on what you
already have.

- **You already have persona/identity code.** Don't import the core to replace
  it — swapping identical logic for a dependency is pure churn. Adopt the
  [conformance vectors](/spec/conformance) as tests against *your own*
  implementation instead: they freeze the wire format so your codec can't drift
  from another implementation's. It is the cheapest, highest-value first step,
  and it adds no runtime dependency.
- **You need verified accounts or cross-device continuity.** Climb the ladder
  only when a feature earns it — a durable browser key, then a verified account
  via OIDC, then linking across apps. Each step is opt-in; reading stays
  anonymous and the browser stays the entity throughout.
- **You depend on the code.** Pin to a release tag — the first is `v0.1.0`. A
  tag is what freezes the wire format and invariants you are conforming to.

## Following along

Start with the [protocol specification](/spec/) — the normative source for both
transports. The reference libraries (TypeScript and Ruby) implement it against
the shared conformance vectors.
