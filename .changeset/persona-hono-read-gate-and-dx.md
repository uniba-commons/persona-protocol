---
"@uniba-commons/persona-hono": minor
---

Add `requirePersona`, the read-gate companion to `requireJoined`: it requires a resolved persona on every method (GET included), for routes that are owner-only on read (a settings or profile page an anonymous browser must not see even on GET). `requireJoined` remains the write-only gate that leaves reads anonymous (P-1).

Make `personaMiddleware`'s context variable configurable via `contextKey` (default `persona`), so an app whose routes already read `c.get('user')` can reuse that key without renaming call sites.

Loosen the `setPending`/`readPending` payload constraint from `Record<string, unknown>` to `object`, so a declared `interface` (which has no implicit index signature) is accepted alongside a `type` alias.
