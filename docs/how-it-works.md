# How it works

persona-kit has a small vocabulary. Learn these six words and the whole model
falls into place.

## The vocabulary

- **Persona** — the identity node: the thing your app treats as "a user". It
  exists server-side, but it *belongs* to whoever holds its credential. There
  is no registration; a persona comes into being when someone joins.
- **Browser** — the unit identity is anchored to. One persona can be used from
  many browsers.
- **agent_uid** — a self-asserted key that ties a browser to a persona. The
  browser holds it; the server only compares it. Because nothing has verified
  it, it is a secret.
- **Agent binding** — an attachment of an `agent_uid` to a persona.
  Self-asserted, kept secret.
- **Account binding** — an attachment of a *verified* identity
  (`provider` + `subject`) to a persona. Vouched for by an identity provider,
  safe to show. A persona can have several.
- **Claim code** — a single-use code that lets another browser take over a
  persona. Stored only as a digest; invalidated the instant it is used.

The two binding kinds are the heart of the model: a persona can be held by a
**secret self-asserted key**, a **verified account**, or both. They carry
different trust, so they are stored and exposed differently.

## The lifecycle

A persona moves through these stages. Each is optional after the first — a
visitor can stop at any point.

| Stage | What happens | What the user did |
| --- | --- | --- |
| **Read** | No identity exists. Content is served to everyone. | Opened the app |
| **Join** | On the first write, the app proposes a persona; the user confirms; an agent binding is created. | Wrote something, opted in |
| **Carry** | The persona issues a single-use claim code; another browser redeems it and gains its own agent binding. | Moved to a second device |
| **Graft** | An OIDC round-trip attaches a verified account binding to the persona. | Linked a real account |
| **Merge** | Two personas collide on one verified identity; a preview is shown; on confirm they fold into one. | Consolidated two devices/personas |

### Read → Join

Reading never touches identity. When a visitor first tries to write, the server
answers with a `NOT_JOINED` signal instead of the write. The client turns that
into a small "join" step — propose a name, confirm — and the write is retried
transparently. Nothing is persisted until the user confirms.

### Carry: claim codes instead of passwords

To use the same persona elsewhere, the holding browser issues a claim code. The
server stores only its digest. The second browser redeems the code once — the
code dies on use — and receives its own agent binding to the same persona. No
password exists to phish, and no shared secret sits in a database.

### Graft: attaching a verified identity

Account linking is an optional round-trip with an identity provider you
register (Google, an organization's IdP, …). It produces an **account binding**
— the higher-trust kind — without disturbing the persona's existing data. The
`agent_uid` never appears in any URL during the flow; only opaque, short-lived
tokens do.

### Merge: the two-phase conflict

The interesting case is when the browser is already a *different* persona than
the one holding the target identity. persona-kit does not pick a winner
silently. It returns a **merge preview** — a description of what would move —
and changes nothing. Only when the user confirms does the acting persona fold
into the holder, carrying its bindings and its data. This preview-then-confirm
rule is a protocol guarantee, not an application courtesy.

## Two transports, one model

The model above is transport-agnostic. persona-kit ships two **profiles** for
carrying the credential, chosen by where your app needs it:

- **Header profile** — the browser holds the `agent_uid` and sends it in an
  `X-Agent-Id` header. Fits API-separated clients: SPAs, native apps, CLIs.
- **Cookie profile** — the credential rides in an HMAC-signed session cookie
  and reaches the server automatically on every request, including server-side
  rendering and WebSocket handshakes. Fits server-rendered and hybrid stacks.

Both profiles obey the same invariants; only the carriage differs. See
[the protocol](/protocol) for the normative details.

## Persistent by choice, disposable by default

Because a persona is anchored in the browser and never forced by the server, it
has a property hosted accounts don't: it is **disposable unless the user makes
it durable**. Clear the browser and an un-grafted persona is simply gone — the
digital equivalent of posting once under a throwaway handle and never using it
again. Issue a claim code or link an account and the same machinery makes the
persona **persistent and portable**. One mechanism spans "leave no trace" and
"this is me everywhere", and the user decides which.
