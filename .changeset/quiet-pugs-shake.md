---
'@uniba-commons/persona-hono': minor
---

Make `contextKey` compose with the built-in gates. `personaMiddleware` honoured
the option but `requireJoined` and `requirePersona` read `c.get('persona')`
unconditionally, so setting `contextKey` turned both gates into blanket
rejections — a joined persona was rejected along with everyone else.

The middleware now records the key it wrote to, and the gates read that key.
Consumers set `contextKey` once on the middleware and can drop any shim
middleware that mirrored the persona onto a second variable. Both gates also
accept an explicit `contextKey` for the case where a gate runs without
`personaMiddleware` ahead of it.
