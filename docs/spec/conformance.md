# Conformance

Implementations are assessed against the requirement IDs throughout this spec.
The same vectors run against every language implementation, so a Ruby backend and
a TypeScript backend cannot drift. Fixtures live under `conformance/` in the
repository.

## The three suites

1. **Claim decision table** — the six rows of [Claims](/spec/claims), plus
   [P-12](/spec/claims#p-12) holder re-resolution. Encoded as
   `{browser_state, holder_state, confirm} -> {action, echo, merged}` vectors run
   against each implementation's claim logic.
2. **Session cookie** — [C-1](/spec/cookie-profile#c-1) sign/verify vectors (key,
   payload, expiry, token), including tampered, expired, and malformed negatives.
3. **Wire names** — the `X-Agent-Id` / `agent_id` / `NOT_JOINED` constants agree
   across language packages.

## Running them

Both suites load the shared JSON fixtures directly:

```bash
cd gems/persona && bundle exec rspec   # Ruby runner
npm test                               # TypeScript runner (vitest)
```

A vector that only one implementation can satisfy is a spec bug, not an
implementation detail — raise it against the spec rather than special-casing a
runner.
