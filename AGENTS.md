# persona-protocol

## What this repository is for

Picture two applications. Each keeps its own store of personas.

Someone arrives at one of them and gets a persona when they first write
something. To carry it to a second browser they use a code they issued
themselves. To attach a verified account they sign in to a provider from that
application, and attach it there.

When that person also turns up at the second application, they do all of it
again: they get a persona there too, and they attach the same verified account
there, themselves.

Only then can the two applications treat that person as the same person — not
because one asked the other, and not because both read one store, but because
the person attached the same thing in both.

That is more work per application. It is the price of having no centre, and this
design pays the price on purpose. A proposal that reduces the work is usually a
proposal to build a place that answers on someone's behalf, and what got cheaper
has only moved there.

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
