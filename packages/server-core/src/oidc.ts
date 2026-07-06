// OIDC account linking — the provider contract and registry (doc/protocol.md
// §7). A provider is one object per IdP behind three methods; applications gain
// a new provider by registering it, not by reimplementing the flow. Mirrors the
// Ruby gem's Persona::Oidc (gems/persona/lib/persona/oidc.rb).

// The verified outcome of an OIDC round-trip: which provider vouched for the
// browser, and the stable subject the token was issued for. This pair becomes
// an account binding.
export type Identity = { provider: string; subject: string };

export interface OidcProvider {
  // Stable identifier stored on account bindings ('google', 'my-org-idp', …).
  readonly name: string;
  // Where the begin step sends the browser to authenticate. Only the opaque
  // state may ride the URL (P-14).
  authorizeUrl(state: string): string;
  // Callback verification. Real providers exchange the code and validate the
  // token against the IdP's published keys; may be async.
  verify(params: Record<string, unknown>): Identity | null | Promise<Identity | null>;
}

// Local / development stand-in for a real provider. Its authorize URL points at
// an app-local page, and verify trusts a subject handed straight through the
// callback params — NO cryptographic verification. MUST NOT be deployed to
// production (P-16).
export class StubProvider implements OidcProvider {
  readonly name: string;
  private readonly authorizePath: string;

  constructor(opts: { name?: string; authorizePath?: string } = {}) {
    this.name = opts.name ?? 'stub';
    this.authorizePath = opts.authorizePath ?? '/auth/oidc/start';
  }

  authorizeUrl(state: string): string {
    return `${this.authorizePath}?state=${encodeURIComponent(state)}`;
  }

  verify(params: Record<string, unknown>): Identity | null {
    const sub = params.sub;
    if (typeof sub !== 'string' || sub === '') return null;
    return { provider: this.name, subject: sub };
  }
}

export interface ProviderRegistry {
  register(provider: OidcProvider): OidcProvider;
  // Resolves a provider by name; throws for a name that was never registered so
  // a begin/callback for an unknown provider fails loudly (mirrors the Ruby
  // Persona.oidc_provider contract).
  get(name: string): OidcProvider;
  has(name: string): boolean;
}

// Empty by default: register providers explicitly, including the development
// stub — an unregistered provider can never verify.
export const createProviderRegistry = (providers: OidcProvider[] = []): ProviderRegistry => {
  const map = new Map<string, OidcProvider>();
  for (const p of providers) map.set(p.name, p);
  return {
    register(provider) {
      map.set(provider.name, provider);
      return provider;
    },
    get(name) {
      const provider = map.get(name);
      if (!provider) {
        throw new Error(`unknown OIDC provider ${JSON.stringify(name)} — register it via the provider registry`);
      }
      return provider;
    },
    has(name) {
      return map.has(name);
    },
  };
};
