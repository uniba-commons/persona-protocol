# Compared to hosted auth

persona-kit overlaps with the anonymous-and-upgrade features of hosted identity
services, so it is fair to line them up. This page is deliberately even-handed:
the hosted options are mature, managed, and battle-tested, and for many apps
they are the right call. persona-kit is for the cases where their shape — a
service that owns the identity data — is the thing you want to avoid.

The comparison below is drawn from each vendor's own documentation.

## At a glance

| | persona-kit | Firebase Anonymous Auth | Supabase | Auth0 | PlayFab |
| --- | :--: | :--: | :--: | :--: | :--: |
| Read with **no identity at all** | ✅ | ⚠️¹ | ⚠️¹ | ❌ | ✅ |
| Identity created on **first write**, not app load | ✅ | ❌ | ❌ | — | ⚠️² |
| **Cross-device transfer** of the anonymous persona | ✅ claim code | ❌ | ❌ | ❌ | ⚠️² |
| **Merge on conflict** built in | ✅ preview→confirm | ❌³ | ❌³ | ❌³ | ❌³ |
| Upgrade to a **verified account** in place | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multi-provider** account linking | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Self-hosted / no vendor** | ✅ | ❌ | ⚠️⁴ | ❌ | ❌ |
| You own the **identity data** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Transport** you control | ✅ header *or* cookie | SDK | SDK | SDK | SDK |

<small>

1. Firebase and Supabase support *anonymous users*, but the anonymous identity
   is minted at app load, not on first write, and anonymous sign-in is a rate-
   limited, abuse-flagged operation rather than a free read.
2. PlayFab's device login is anonymous-first and supports transfer codes, but
   it is a game-backend platform, not a web identity library.
3. Every hosted option delegates conflict resolution to your application:
   Firebase fails the link ("you must handle merging"), Supabase leaves it to
   the developer, Auth0 discards the secondary account's metadata, and PlayFab
   overwrites via `ForceLink` (explicitly a profile *selection*, not a merge).
4. Supabase is open-source and self-hostable, but anonymous identity there is
   still session-bound with no built-in cross-device transfer.

</small>

## What the incumbents get right

The **anonymous → verified upgrade** is a solved, convergent pattern, and
persona-kit deliberately mirrors it rather than inventing something new. Every
system keeps a stable internal identity and *links* a provider credential onto
it in place, so no data migration happens in the common case. persona-kit's
account binding works the same way. If you are already happy inside one of these
platforms and only need the upgrade flow, you do not need persona-kit.

## Where persona-kit diverges

Three lines in the table are the whole reason it exists.

**Cross-device transfer of an anonymous persona.** In Firebase and Supabase, an
anonymous identity is lost on sign-out, cache clear, or device switch — there is
no way to carry it. persona-kit's single-use claim code is exactly this missing
piece, and it works *before* any account is attached.

**Merge on conflict.** This is the sharpest difference. The moment two personas
resolve to one verified identity is inevitable, and it is the one moment every
hosted system pushes back onto your application code. persona-kit specifies a
preview-then-confirm merge as part of the protocol, so the guarantee "nothing
changes until you confirm" holds across every implementation.

**Ownership and transport.** persona-kit is a protocol you embed, not a service
you call. The identity records are rows in your database; the credential travels
by a header or a cookie you control; the wire format is written down so a Ruby
backend and a TypeScript backend can't drift apart. There is no per-active-user
price because there is no meter.

## The honest trade-offs

persona-kit asks more of you in return:

- **You operate it.** No managed dashboard, no SLA, no support contract. You run
  the storage and register the OIDC provider.
- **It is young.** The hosted options have years of production hardening;
  persona-kit is pre-v0.
- **It is scoped.** It does anonymous-first identity and account *linking*. It is
  not a full IdP, an authorization framework, or a user-management console.

If those are acceptable — or if avoiding a vendor for your identity layer is a
requirement rather than a preference — persona-kit is built for you. If you want
a managed service that handles identity end to end, one of the incumbents will
serve you better, and that is a fine answer.
