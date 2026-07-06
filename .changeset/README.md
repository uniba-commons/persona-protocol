# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets),
the release tool for the npm workspace.

To record a change for the next release, run `npx changeset` and describe it; a
markdown file lands here and is consumed by `npx changeset version` (which bumps
versions and writes CHANGELOGs) and `npx changeset publish` (which publishes and
tags).

Scope: the `@uniba-commons/persona-*` npm packages, including
`@uniba-commons/persona-conformance`. The Ruby gem versions separately
(`gems/persona/lib/persona/version.rb` + a git tag). See
[doc/decisions/0008-distribution-and-release.md](../doc/decisions/0008-distribution-and-release.md).
