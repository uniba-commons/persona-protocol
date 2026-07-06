# What is persona-kit?

persona-kit is a protocol — with Ruby and TypeScript reference libraries — for
**identity that starts anonymous and travels with the browser**. A visitor uses
your app with no login, picks up a persona the moment they first contribute, and
can later attach a verified account to it. You run all of it yourself; there is
no service in the middle.

## The two bad defaults

Most apps pick one of two unhappy extremes:

- **The login wall.** Nothing works until the visitor creates an account. Every
  first-time user meets a form before they meet the product. Great for your user
  table, terrible for the person who just wanted to look.
- **Throwaway anonymity.** The visitor can act without an account, but their
  contributions are tied to a cookie that evaporates on the next device, the
  next browser, or the next cache clear. There is no way to *become* someone
  without starting over.

persona-kit is the path between them: **anonymous until it matters, portable
when it does, verifiable if you want it.**

## Four things that make it different

### 1. Anonymous even longer than you'd expect

Hosted anonymous-auth SDKs mint an anonymous identity the moment the app loads.
persona-kit does not: **reading requires no identity at all**, and a persona is
created only on the first *write*. The visitor who browses and leaves was never
an "anonymous user #48213" — they were nobody, by design.

### 2. The browser is the entity, not an account you log into

A persona is anchored to a self-asserted key the browser holds. The server
**never issues that key and never echoes it back** — so there is no server-owned
identifier a user can be trapped inside. To use the same persona on a second
browser, the first one issues a **single-use claim code**; there is no password,
no email round-trip, no account recovery desk.

### 3. Merge is part of the protocol

Sooner or later two personas point at the same verified identity — the same
person joined on their laptop and their phone, then linked both to one Google
account. Every hosted auth system we surveyed hands this moment back to you:
Firebase fails the link and tells you to "handle merging"; Auth0 discards the
secondary account's data; PlayFab overwrites one profile and can orphan the
other. persona-kit specifies it instead: a **merge preview** first, changing
nothing, then a **confirm**. Data is never silently lost.

### 4. It is a protocol, not a platform

Firebase, Supabase, Auth0, and PlayFab are services: they hold your identity
data and charge by active user. persona-kit is a **spec plus libraries you
embed**. Identity records live in *your* database; the OIDC provider is *your*
choice; the wire format is documented so a second implementation can't drift.
Nothing phones home.

## What persona-kit is *not*

- **Not a hosted service.** There is no persona-kit account, dashboard, or
  endpoint. You wire the libraries into your own backend.
- **Not a full IdP.** It does the anonymous-first half and the account-*linking*
  half; the actual credential verification is delegated to a real OIDC provider
  you register.
- **Not finished.** persona-kit is pre-v0: the protocol and the reference
  libraries are being built and proven against real consumers in the open. See
  [Get started](/get-started) for what exists today.

## Who it's for

Apps where the *content* should be open to everyone but *contributing* should
carry a stable-ish identity, and where you would rather own that identity layer
than rent it: community maps, collaborative documents, forums, guestbooks,
event tools, local-first apps with a server. If "make people sign up first"
feels like the wrong shape for your product, persona-kit is the other shape.

Next: [how it works](/how-it-works), or [how it compares](/comparison) to the
hosted options.
