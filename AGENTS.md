# persona-protocol

## What this repository is for

On most of the web, being someone means holding an account that a service
issued. persona-protocol is the other arrangement: identity that begins with the
person, which a server can only recognise.

The world it describes:

- Anyone can read anything without being anyone. No identity exists until
  someone writes.
- When they write, they become someone by an act of their own: the browser
  holds a key that no server issued and no server echoes. There is no
  registration, so there is no issuer.
- Staying that someone on a second browser is also their act: a code they issue
  themselves, spent on use.
- Being trusted is their act too: they attach a verified account from a
  provider when it earns its place. Until then the persona lasts exactly as long
  as they keep it. If two of their personas meet on one verified account,
  nothing folds until they confirm it.
- Because no one issued the identity, no one can be asked who someone is. Each
  application knows a person exactly as far as that person has shown themselves
  to it.

That last line has a cost, and this repository keeps paying it. Picture two
applications, each with its own store of personas. When the same person turns
up at both, they get a persona in each, and attach the same verified account in
each, themselves. Only then can the two treat them as the same person — not
because one asked the other, and not because both read one store, but because
the person showed the same thing in both.

That is more work per application, and it is paid on purpose. A proposal that
reduces the work is usually a proposal for a place that answers on someone's
behalf. That place is an issuer, and what got cheaper has only moved there.

## Working here

- `docs/spec/` is the normative text. Where an implementation and the spec
  disagree the spec wins, so a defect is fixed in the spec first and the
  libraries follow it.
- Consumers are inputs, not references. What they report shapes the spec; what
  they are shaped like does not belong in it — no consumer names, no
  organisation-specific values, no design history.
- Everything in the repository and on GitHub is written in English: identifiers,
  comments, documentation, commit messages, pull requests, issues.
- `npm test` runs the TypeScript side, `cd gems/persona && bundle exec rspec` the
  Ruby side; both load the shared vectors in `conformance/`, so the two
  implementations cannot drift. `npm run docs:build` builds the spec site.
