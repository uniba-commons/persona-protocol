import { defineConfig } from 'vitepress'

// The public documentation site. The protocol specification is the main
// content (see /spec/); the narrative pages introduce and position it.
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
      {
        icon: {
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>npm</title><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>',
        },
        link: 'https://www.npmjs.com/package/@uniba-commons/persona-core',
        ariaLabel: 'npm',
      },
    ],

    footer: {
      message: 'Pre-v0. A protocol and reference libraries, developed in the open.',
      copyright:
        'Copyright © 2026 <a href="https://uni.ba/" target="_blank" rel="noreferrer">UNIBA COMMONS</a>',
    },
  },
})
