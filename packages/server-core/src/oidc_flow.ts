// The OIDC account-linking round-trip (docs/spec §7), as three
// transport-neutral steps an adapter wires to its routes. The identity decision
// happens on the credentialed `complete` request (P-8); only opaque tokens ride
// the URL (P-14); `state` is single-use and `link_token` is dropped on success
// (P-15).

import { performAccountLink, type AccountLinkStore, type AccountLinkResult } from './account_link.js';
import type { ProviderRegistry } from './oidc.js';
import type { LinkStore } from './link_store.js';

// Step 1 — begin. Issues an opaque state, stores which provider (and optionally
// which browser, via `binding`) it belongs to, and returns the provider's
// authorize URL for a full-page redirect.
export const beginAccountLink = async (opts: {
  registry: ProviderRegistry;
  linkStore: LinkStore;
  providerName: string;
  binding?: string;
}): Promise<{ state: string; authorizeUrl: string }> => {
  const provider = opts.registry.get(opts.providerName); // throws if unregistered
  const state = opts.linkStore.generateToken();
  const { url, stash } = await provider.authorize(state);
  await opts.linkStore.putPending(state, { provider: opts.providerName, binding: opts.binding, stash });
  return { state, authorizeUrl: url };
};

// Step 2 — callback. Consumes the state once, verifies the IdP outcome through
// the same provider it was begun for, and stashes the verified result under an
// opaque link_token. Returns null for an unknown/expired/replayed state or a
// failed verification.
export const handleOidcCallback = async (opts: {
  registry: ProviderRegistry;
  linkStore: LinkStore;
  state: string;
  params: Record<string, unknown>;
}): Promise<{ linkToken: string; binding?: string } | null> => {
  const pending = await opts.linkStore.takePending(opts.state);
  if (!pending) return null;

  const provider = opts.registry.get(pending.provider);
  const identity = await provider.verify(opts.params, pending.stash);
  if (!identity) return null;

  const linkToken = opts.linkStore.generateToken();
  await opts.linkStore.putResult(linkToken, {
    provider: identity.provider,
    subject: identity.subject,
    binding: pending.binding,
  });
  return { linkToken, binding: pending.binding };
};

// Step 3 — complete. A credentialed request presents the link_token; the
// verified identity is run through the claim decision table. The result token
// is read non-destructively so a merge preview can be re-read on the confirm
// pass, and dropped only once the operation actually settles.
//
// `agentUid` is the key the claim table binds (the browser's key in the header
// profile; the persona's server-side anchor, or a freshly generated one for an
// anonymous sign-up, in the cookie profile). `expectedBinding` is checked
// against the stored binding when one was set at begin (P-16a).
export const completeAccountLink = async <User extends { id: unknown }>(opts: {
  linkStore: LinkStore;
  store: AccountLinkStore<User>;
  linkToken: string;
  currentUser: User | null;
  agentUid: string;
  confirmMerge?: boolean;
  expectedBinding?: string;
}): Promise<AccountLinkResult<User> | null> => {
  const result = await opts.linkStore.peekResult(opts.linkToken);
  if (!result) return null;
  if (result.binding != null && result.binding !== opts.expectedBinding) return null;

  const outcome = await performAccountLink({
    identity: { provider: result.provider, subject: result.subject },
    currentUser: opts.currentUser,
    agentUid: opts.agentUid,
    confirmMerge: opts.confirmMerge ?? false,
    store: opts.store,
  });

  // Keep the token alive across the preview → confirm round-trip; drop it once
  // the operation has settled (a bind, an adopt, or a confirmed merge).
  if (!outcome.mergePreview) await opts.linkStore.dropResult(opts.linkToken);
  return outcome;
};
