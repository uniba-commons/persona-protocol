import { defineConfig } from 'vitepress'

// The public documentation site. The protocol specification is the main
// content (see /spec/); the narrative pages introduce and position it. Internal
// design material (the handoff, decision records, ja design notes) stays in the
// repository's doc/ directory and is intentionally not part of this site.
export default defineConfig({
  lang: 'en-US',
  title: 'persona-protocol',
  description: 'Portable anonymous identity for the web — a protocol you run, not a service you rent.',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Why', link: '/why' },
      { text: 'How it works', link: '/how-it-works' },
      { text: 'Compare', link: '/comparison' },
      { text: 'Get started', link: '/get-started' },
      { text: 'Spec', link: '/spec/' },
    ],

    sidebar: {
      '/spec/': [
        {
          text: 'Specification',
          items: [
            { text: 'Overview', link: '/spec/' },
            { text: '1 · Concepts', link: '/spec/concepts' },
            { text: '2 · Core invariants', link: '/spec/invariants' },
            { text: '3 · Header profile', link: '/spec/header-profile' },
            { text: '4 · Cookie profile', link: '/spec/cookie-profile' },
            { text: '5 · Join', link: '/spec/join' },
            { text: '6 · Claims', link: '/spec/claims' },
            { text: '7 · Account linking', link: '/spec/account-linking' },
            { text: '8 · agent_uid format', link: '/spec/agent-uid' },
            { text: '9 · Security', link: '/spec/security' },
            { text: '10 · Conformance', link: '/spec/conformance' },
          ],
        },
      ],
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is persona-protocol?', link: '/why' },
            { text: 'How it works', link: '/how-it-works' },
            { text: 'Compared to hosted auth', link: '/comparison' },
          ],
        },
        {
          text: 'Using it',
          items: [
            { text: 'Get started', link: '/get-started' },
            { text: 'The protocol', link: '/spec/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/uniba-commons/persona-protocol' },
    ],

    footer: {
      message: 'Pre-v0. A protocol and reference libraries, developed in the open.',
      copyright: 'Uniba Inc.',
    },
  },
})
