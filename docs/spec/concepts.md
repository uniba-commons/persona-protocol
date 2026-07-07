# Concepts and terminology

persona-protocol has a small vocabulary. Six words carry the entire model.

## Persona

The identity node. A server-side record exists for it, but the persona
conceptually **belongs to the browser(s) holding its credential**. There is no
registration step: a persona comes into existence at [join](/spec/join).

## Browser

The unit identity is anchored to. One persona is usable from many browsers. A
browser proves which persona it is acting as by presenting a **credential**.

## Credential

The secret a browser presents with requests. Its shape is profile-specific: the
[agent_uid](#agent-uid) itself in the [header profile](/spec/header-profile), a
signed session cookie in the [cookie profile](/spec/cookie-profile).

## agent_uid {#agent-uid}

A self-asserted bearer key tying a browser to a persona. An
[opaque string](/spec/agent-uid). Because nothing has verified it, it is a
secret.

## Binding

An attachment to a persona. Two kinds exist, with different trust levels
([P-5](/spec/invariants#p-5)):

- **Agent binding** — `agent_uid ↔ persona`. Self-asserted; secret.
- **Account binding** — `(provider, subject) ↔ persona`. Verified by an identity
  provider; safe to expose.

The two binding kinds are the heart of the model. A persona can be held by a
secret self-asserted key, a verified account, or both — and because they carry
different trust, they are stored and exposed differently.

## Claim code

A single-use code that lets another browser (or a future self) take over a
persona. Deployments name these things "recovery code", "migration key", and the
like; the protocol treats them uniformly (see [Claims](/spec/claims)).

## Join

The opt-in moment an anonymous browser acquires a persona (see
[Join](/spec/join)).

## Holder

The persona currently bound to a given subject or claim code.
