# agent_uid format

### P-17 — Opaque {#p-17}

The agent_uid is an **opaque string** (**MUST**). Servers use it for equality
only and **MUST NOT** interpret its structure. Different deployments are free to
choose different formats (UUID v4 and 24-character Crockford base32 are both in
use).

### P-18 — Entropy {#p-18}

Generation **MUST** use a CSPRNG and carry at least 120 bits of entropy.

### P-19 — Minimal acceptance validation {#p-19}

Acceptance-side validation **SHOULD** be minimal — printable ASCII, no
whitespace, a length cap (256 is a reasonable default). Enforcing a specific
format would constrain future consumers for no security gain.
