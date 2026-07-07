import { describe, it, expect } from 'vitest';
import {
  StubProvider,
  createProviderRegistry,
  createLinkStore,
  beginAccountLink,
  handleOidcCallback,
  completeAccountLink,
  type KVStore,
} from '../src/index.js';
import { FakeAccountLinkStore } from './fake_store.js';

// An in-memory KV standing in for Redis/Upstash/CF KV. TTLs are recorded but
// not enforced — the flow tests assert single-use and non-destructive
// semantics, not wall-clock expiry.
class MemoryKV implements KVStore {
  private data = new Map<string, string>();
  ttls: Record<string, number> = {};
  set(key: string, value: string, opts: { ttlSeconds: number }) {
    this.data.set(key, value);
    this.ttls[key] = opts.ttlSeconds;
  }
  get(key: string) {
    return this.data.get(key) ?? null;
  }
  delete(key: string) {
    this.data.delete(key);
  }
}

const registry = () => createProviderRegistry([new StubProvider({ name: 'example-idp' })]);

describe('OIDC provider registry', () => {
  it('resolves a registered provider and throws for an unknown one', () => {
    const r = registry();
    expect(r.get('example-idp').name).toBe('example-idp');
    expect(r.has('google')).toBe(false);
    expect(() => r.get('google')).toThrow(/unknown OIDC provider/);
  });

  it('escapes the state into the stub authorize URL', () => {
    const p = new StubProvider();
    expect(p.authorize('a b&c').url).toBe('/auth/oidc/start?state=a%20b%26c');
  });

  it('verifies a subject and rejects a missing one', () => {
    const p = new StubProvider({ name: 'example-idp' });
    expect(p.verify({ sub: 'person-1' })).toEqual({ provider: 'example-idp', subject: 'person-1' });
    expect(p.verify({})).toBeNull();
    expect(p.verify({ sub: '' })).toBeNull();
  });
});

describe('OIDC round-trip', () => {
  const setup = () => {
    const kv = new MemoryKV();
    return {
      kv,
      registry: registry(),
      linkStore: createLinkStore({ kv }),
      store: new FakeAccountLinkStore(),
    };
  };

  it('carries an anonymous browser through begin → callback → complete (sign-up)', async () => {
    const { registry, linkStore, store } = setup();

    const { state, authorizeUrl } = await beginAccountLink({
      registry,
      linkStore,
      providerName: 'example-idp',
    });
    expect(authorizeUrl).toBe(`/auth/oidc/start?state=${encodeURIComponent(state)}`);

    const callback = await handleOidcCallback({ registry, linkStore, state, params: { sub: 'person-1' } });
    expect(callback).not.toBeNull();

    const result = await completeAccountLink({
      linkStore,
      store,
      linkToken: callback!.linkToken,
      currentUser: null,
      agentUid: 'agent-new',
    });
    expect(result).not.toBeNull();
    expect(result!.merged).toBe(false);
    expect(result!.agentUid).toBe('agent-new');
    expect((await store.holderFor('example-idp', 'person-1'))!.id).toBe(result!.user.id);
  });

  it('treats a state as single-use', async () => {
    const { registry, linkStore } = setup();
    const { state } = await beginAccountLink({ registry, linkStore, providerName: 'example-idp' });

    expect(await handleOidcCallback({ registry, linkStore, state, params: { sub: 'person-1' } })).not.toBeNull();
    // Replaying the same state must fail.
    expect(await handleOidcCallback({ registry, linkStore, state, params: { sub: 'person-1' } })).toBeNull();
  });

  it('returns null when the provider fails to verify', async () => {
    const { registry, linkStore } = setup();
    const { state } = await beginAccountLink({ registry, linkStore, providerName: 'example-idp' });
    expect(await handleOidcCallback({ registry, linkStore, state, params: {} })).toBeNull();
  });

  it('keeps the link_token across a merge preview, then drops it on confirm', async () => {
    const { registry, linkStore, store } = setup();

    // A different persona X already holds the subject; the acting browser Y is
    // a joined, different persona → conflict.
    const holder = await store.createGuest('agent-x');
    await store.addAccountBinding(holder, 'example-idp', 'person-1');
    const current = await store.createGuest('agent-y');

    const { state } = await beginAccountLink({ registry, linkStore, providerName: 'example-idp' });
    const { linkToken } = (await handleOidcCallback({ registry, linkStore, state, params: { sub: 'person-1' } }))!;

    // First complete (no confirm) → preview, token NOT dropped.
    const preview = await completeAccountLink({
      linkStore,
      store,
      linkToken,
      currentUser: current,
      agentUid: 'agent-y',
    });
    expect(preview!.mergePreview).not.toBeNull();
    expect(preview!.merged).toBe(false);
    expect(await linkStore.peekResult(linkToken)).not.toBeNull();

    // Second complete (confirm) → merged, token dropped.
    const confirmed = await completeAccountLink({
      linkStore,
      store,
      linkToken,
      currentUser: current,
      agentUid: 'agent-y',
      confirmMerge: true,
    });
    expect(confirmed!.merged).toBe(true);
    expect(confirmed!.user.id).toBe(holder.id);
    expect(await linkStore.peekResult(linkToken)).toBeNull();
  });

  it('rejects a complete whose browser binding does not match (P-16a)', async () => {
    const { registry, linkStore, store } = setup();
    const { state } = await beginAccountLink({
      registry,
      linkStore,
      providerName: 'example-idp',
      binding: 'browser-1',
    });
    const { linkToken } = (await handleOidcCallback({ registry, linkStore, state, params: { sub: 'person-1' } }))!;

    const wrong = await completeAccountLink({
      linkStore,
      store,
      linkToken,
      currentUser: null,
      agentUid: 'agent-new',
      expectedBinding: 'browser-2',
    });
    expect(wrong).toBeNull();

    const right = await completeAccountLink({
      linkStore,
      store,
      linkToken,
      currentUser: null,
      agentUid: 'agent-new',
      expectedBinding: 'browser-1',
    });
    expect(right).not.toBeNull();
  });

  it('returns null for an unknown link_token', async () => {
    const { linkStore, store } = setup();
    const result = await completeAccountLink({
      linkStore,
      store,
      linkToken: 'nope',
      currentUser: null,
      agentUid: 'agent-new',
    });
    expect(result).toBeNull();
  });
});
