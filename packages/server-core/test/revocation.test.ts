import { describe, it, expect } from 'vitest';
import { NOT_JOINED_CODE, BINDING_NOT_FOUND_CODE } from '@uniba-commons/persona-core';
import { performRevocation, supportsRevocation, type RevocableStore } from '../src/revocation.js';
import { FakeAccountLinkStore, type FakeUser } from './fake_store.js';

const IDP = { provider: 'example-idp', subject: 'person-1' };
const OTHER = { provider: 'other-idp', subject: 'person-2' };

// A persona with one browser and the account bindings named.
async function persona(store: FakeAccountLinkStore, agentUid: string, ...subjects: typeof IDP[]) {
  const user = await store.createGuest(agentUid);
  for (const s of subjects) await store.addAccountBinding(user, s.provider, s.subject);
  return user;
}

const revokeAccount = (store: RevocableStore<FakeUser>, currentUser: FakeUser | null, subject: typeof IDP, confirm = false) =>
  performRevocation({ target: { kind: 'account', ...subject }, currentUser, confirm, store });

describe('performRevocation — who may revoke (P-20)', () => {
  it('rejects an anonymous browser as NOT_JOINED', async () => {
    const store = new FakeAccountLinkStore();
    await persona(store, 'agent-1', IDP);

    const result = await revokeAccount(store, null, IDP);

    expect(result).toEqual({ revoked: false, preview: null, code: NOT_JOINED_CODE, clearCredential: false });
    expect(store.accountBindings).toHaveLength(1);
  });

  it('reports a binding held by another persona exactly as an absent one', async () => {
    const store = new FakeAccountLinkStore();
    const other = await persona(store, 'agent-other', IDP);
    const me = await persona(store, 'agent-me', OTHER);

    const notMine = await revokeAccount(store, me, IDP);
    const absent = await revokeAccount(store, me, { provider: 'nobody', subject: 'nothing' });

    // Indistinguishable to the caller (P-25) — otherwise revocation is a probe
    // for bindings held by other personas.
    expect(notMine).toEqual(absent);
    expect(notMine.code).toBe(BINDING_NOT_FOUND_CODE);
    expect(await store.holderFor(IDP.provider, IDP.subject)).toEqual(other);
  });
});

describe('performRevocation — account bindings (P-21, P-22)', () => {
  it('removes a binding that is not the last one in a single step', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP, OTHER);

    const result = await revokeAccount(store, me, IDP);

    expect(result.revoked).toBe(true);
    expect(result.preview).toBeNull();
    expect(await store.listAccountBindings(me)).toEqual([{ provider: OTHER.provider, subject: OTHER.subject }]);
  });

  it('previews the last binding and changes nothing until confirmed', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);

    const preview = await revokeAccount(store, me, IDP);

    expect(preview.revoked).toBe(false);
    expect(preview.preview).toEqual({
      lastAccountBinding: true,
      remainingAccountBindings: 0,
      redeemableClaimCode: false,
      remainingAgentBindings: 1,
    });
    expect(store.accountBindings).toHaveLength(1);

    const confirmed = await revokeAccount(store, me, IDP, true);

    expect(confirmed.revoked).toBe(true);
    expect(store.accountBindings).toHaveLength(0);
  });

  it('reports a redeemable claim code, so the preview does not read as stranding (P-22a)', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);
    store.redeemableClaimCodes.add(me.id);

    const { preview } = await revokeAccount(store, me, IDP);

    expect(preview?.redeemableClaimCode).toBe(true);
  });

  it('frees the subject, so a later link is a fresh bind (P-21)', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);

    await revokeAccount(store, me, IDP, true);

    expect(await store.holderFor(IDP.provider, IDP.subject)).toBeNull();
  });

  it('re-evaluates "is this the last one" on the call that would remove it (P-22)', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP, OTHER);
    // Another browser revokes the second binding while the user is deciding.
    await store.revokeAccountBinding(me, OTHER.provider, OTHER.subject);

    const result = await revokeAccount(store, me, IDP);

    expect(result.revoked).toBe(false);
    expect(result.preview?.lastAccountBinding).toBe(true);
  });
});

describe('performRevocation — agent bindings (P-23)', () => {
  it("clears the credential when the acting browser revokes its own binding", async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);
    await store.addAgentBinding(me, 'agent-laptop');

    const result = await performRevocation({
      target: { kind: 'agent', agentUid: 'agent-me' },
      currentUser: me,
      actingAgentUid: 'agent-me',
      store,
    });

    expect(result).toEqual({ revoked: true, preview: null, code: null, clearCredential: true });
    expect(await store.countAgentBindings(me)).toBe(1);
  });

  it('leaves the acting credential alone when another browser is revoked', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);
    await store.addAgentBinding(me, 'agent-laptop');

    const result = await performRevocation({
      target: { kind: 'agent', agentUid: 'agent-laptop' },
      currentUser: me,
      actingAgentUid: 'agent-me',
      store,
    });

    expect(result.revoked).toBe(true);
    expect(result.clearCredential).toBe(false);
  });

  it('is single-step even when it removes the only browser', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);

    const result = await performRevocation({
      target: { kind: 'agent', agentUid: 'agent-me' },
      currentUser: me,
      actingAgentUid: 'agent-me',
      store,
    });

    // P-22 governs the last *account* binding; an agent binding is not it.
    expect(result.revoked).toBe(true);
    expect(result.preview).toBeNull();
  });

  it('reports an unknown browser as BINDING_NOT_FOUND', async () => {
    const store = new FakeAccountLinkStore();
    const me = await persona(store, 'agent-me', IDP);

    const result = await performRevocation({
      target: { kind: 'agent', agentUid: 'agent-never-seen' },
      currentUser: me,
      store,
    });

    expect(result.code).toBe(BINDING_NOT_FOUND_CODE);
  });
});

describe('performRevocation — stores without the optional port', () => {
  // A store from before revocation existed: the link half only.
  const legacyStore = (): RevocableStore<FakeUser> => {
    const full = new FakeAccountLinkStore();
    return {
      holderFor: full.holderFor.bind(full),
      withinTransaction: full.withinTransaction.bind(full),
      createGuest: full.createGuest.bind(full),
      addAccountBinding: full.addAccountBinding.bind(full),
      hasAgentBinding: full.hasAgentBinding.bind(full),
      addAgentBinding: full.addAgentBinding.bind(full),
      mergePreview: full.mergePreview.bind(full),
      merge: full.merge.bind(full),
    };
  };

  it('is detectable before the moves are offered', () => {
    expect(supportsRevocation(legacyStore())).toBe(false);
    expect(supportsRevocation(new FakeAccountLinkStore())).toBe(true);
  });

  it('names the missing methods when called anyway', async () => {
    await expect(
      revokeAccount(legacyStore(), { id: 1 }, IDP),
    ).rejects.toThrow(/does not implement the revocation port .*listAccountBindings/);
  });
});
