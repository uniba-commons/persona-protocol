import { defineConfig } from 'vitepress'

// The public documentation site — the outward-facing self-introduction for
// persona-kit, written for prospective adopters weighing it against Firebase,
// Supabase, Auth0, and PlayFab. Internal design material (the handoff, the
// decision records, the ja design notes) stays in the repository's doc/
// directory and is intentionally not part of this site.
export default defineConfig({
  lang: 'en-US',
  title: 'persona-kit',
  description: 'Portable anonymous identity for the web — a protocol you run, not a service you rent.',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Why', link: '/why' },
      { text: 'How it works', link: '/how-it-works' },
      { text: 'Compare', link: '/comparison' },
      { text: 'Get started', link: '/get-started' },
      { text: 'Protocol', link: '/protocol' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is persona-kit?', link: '/why' },
          { text: 'How it works', link: '/how-it-works' },
          { text: 'Compared to hosted auth', link: '/comparison' },
        ],
      },
      {
        text: 'Using it',
        items: [
          { text: 'Get started', link: '/get-started' },
          { text: 'The protocol', link: '/protocol' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/uniba-commons/persona-kit' },
    ],

    footer: {
      message: 'Pre-v0. A protocol and reference libraries, developed in the open.',
      copyright: 'Uniba Inc.',
    },
  },
})
