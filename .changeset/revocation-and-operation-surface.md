---
'@uniba-commons/persona-core': minor
'@uniba-commons/persona-server-core': minor
---

Name the account-link operation surface and add revocation.

The spec now names the four moves — begin, complete, revoke, list (P-24) — and
the link flow's protocol states (P-25): `ACCOUNT_LINKING_DISABLED`,
`INVALID_ACCOUNT_LINK` and `BINDING_NOT_FOUND`, all three exported alongside
`NOT_JOINED` and pinned by the shared vectors.

Revocation (P-20..P-23) arrives as `performRevocation`. Revoking an account
binding leaves the browser joined; revoking an agent binding removes one
browser's access and, for the acting browser, reports `clearCredential` so its
stored credential can be discarded. Removing a persona's *last* account binding
is two-step: the first call returns a preview stating what survives — a still
redeemable claim code, the remaining browsers — and changes nothing. With a
single provider registered that is every revocation, not an edge case.

The storage port grows an optional half (`listAccountBindings`,
`revokeAccountBinding`, `revokeAgentBinding`, `countAgentBindings`,
`hasRedeemableClaimCode`). Existing stores keep working untouched:
`supportsRevocation(store)` reports whether the revoke/list moves can be
offered, so this is additive rather than a breaking port change.
