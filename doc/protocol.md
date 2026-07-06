# persona-kit protocol — moved

The normative specification now lives in the documentation site, split into
navigable chapters. Source: `docs/spec/*.md`. Run `npm run docs:dev` to read it
locally, or see the published site.

The requirement IDs (`P-*`, `H-*`, `C-*`) are unchanged, so references to them
from the decision records remain valid. Section-number references map to chapters
as follows:

| Old §  | Chapter | Source file |
|--------|---------|-------------|
| intro  | Overview            | `docs/spec/index.md` |
| §1     | Concepts            | `docs/spec/concepts.md` |
| §2     | Core invariants     | `docs/spec/invariants.md` |
| §3     | Header profile      | `docs/spec/header-profile.md` |
| §4     | Cookie profile      | `docs/spec/cookie-profile.md` |
| §5     | Join                | `docs/spec/join.md` |
| §6     | Claims              | `docs/spec/claims.md` |
| §7     | Account linking     | `docs/spec/account-linking.md` |
| §8     | agent_uid format    | `docs/spec/agent-uid.md` |
| §9     | Security            | `docs/spec/security.md` |
| §10    | Conformance         | `docs/spec/conformance.md` |
