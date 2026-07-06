# Security considerations

- **The agent_uid is a bearer secret**: leakage equals impersonation.
  [P-3](/spec/invariants#p-3) must extend to operational surfaces — access logs
  in particular. When the `agent_id` query parameter is used
  ([H-2](/spec/header-profile#h-2)), confirm it is excluded from request logging.
- **Claim codes** survive database exposure (digest-only storage) and race
  conditions (atomic consumption) by [P-7](/spec/invariants#p-7).
- **The cookie profile's MAC key is a server secret.** Rotate it with dual-key
  verification (accept old + new during the window) rather than invalidating
  every browser's session at once (**SHOULD**).
- **A merge is destructive** (the source persona is retired). Do not let UI
  flatten [P-6](/spec/invariants#p-6)'s preview → confirm into a single reflexive
  click.
- **Anonymous read** ([P-1](/spec/invariants#p-1)) is open to scrapers by design.
  If that matters, defend at layers other than identity (rate limiting, …).
