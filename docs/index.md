---
layout: home

hero:
  name: persona-protocol
  text: Identity that starts anonymous and stays the user's
  tagline: Start with no login. Carry a per-browser persona. Graft it onto a verified account only when it earns its place — and own every byte, because it's a protocol you run, not a service you rent.
  actions:
    - theme: brand
      text: What is persona-protocol?
      link: /why
    - theme: alt
      text: Read the spec
      link: /spec/
    - theme: alt
      text: Compare to hosted auth
      link: /comparison

features:
  - icon: 👁️
    title: Anonymous by default
    details: Visitors read without any identity and acquire a persona only when they first write. No signup wall, no "create an account to continue".
  - icon: 🔑
    title: The browser is the entity
    details: A persona lives in the browser and moves to another one with a single-use claim code. The server never issues or echoes the key, so there is nothing to lock a user into.
  - icon: 🔀
    title: Merge is in the protocol
    details: When two personas collide on the same verified identity, persona-protocol resolves it with a preview-then-confirm merge — the one step every hosted auth hands back to your app.
  - icon: 📦
    title: A spec, not a platform
    details: One transport-agnostic protocol with Ruby and TypeScript adapters. Bring your own database and OIDC provider. No vendor, no per-active-user bill.
---
