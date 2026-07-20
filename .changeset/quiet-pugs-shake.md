---
'@uniba-commons/persona-hono': minor
---

Make `contextKey` compose with the built-in gates. `personaMiddleware` honoured
the option but `requireJoined` and `requirePersona` read `c.get('persona')`
unconditionally, so setting `contextKey` turned both gates into blanket
rejections — a joined persona was rejected along with everyone else.

The middleware now records the key it wrote to, and the gates read that key. An
app that mirrored the persona onto a second variable to work around this can
drop that shim. Both gates also accept an explicit `contextKey`, for a gate that
runs without `personaMiddleware` ahead of it.

Note for anyone who pinned the old behaviour in a test: a gated request that was
rejected under a custom `contextKey` now succeeds.
