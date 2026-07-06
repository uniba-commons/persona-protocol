---
"@uniba-commons/persona-core": patch
"@uniba-commons/persona-server-core": patch
"@uniba-commons/persona-hono": patch
"@uniba-commons/persona-apollo": patch
"@uniba-commons/persona-cable": patch
---

Pin internal dependency ranges (`*` → `^0.1.0`) so published packages resolve to matching workspace versions. Declare `publishConfig.access: "public"` on every scoped package so the first scoped publish is public rather than restricted. Ships alongside the new `@uniba-commons/persona-conformance` package — the versioned conformance vectors, adopted as tests against any implementation.
