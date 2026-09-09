import {
  NOT_JOINED_CODE,
  BINDING_NOT_FOUND_CODE,
} from '@uniba-commons/persona-core';
import type { AccountLinkStore } from './account_link.js';

// Revocation (docs/spec P-20..P-23) and the read behind it (P-24 "list").
//
// The two things a persona can revoke are different operations: dropping an
// account binding leaves the browser joined, while dropping an agent binding
// removes one browser's access and, for the acting browser, ends with its
// credential discarded (P-23).

export type AccountBindingRef = { provider: string; subject: string };

export type RevocationTarget =
  | { kind: 'account'; provider: string; subject: string }
  | { kind: 'agent'; agentUid: string };

// The optional half of the storage port. A store that implements it gains
// revocation and listing; one that does not is simply a store without
// revocation — call supportsRevocation() before offering the moves, rather
// than discovering it at request time.
export type RevocationStore<User> = {
  // P-24 "list". Never returns a credential — account bindings are exposable,
  // agent bindings are not (P-5).
  listAccountBindings(user: User): Promise<AccountBindingRef[]>;
  // Both return false when the persona holds no such binding, which is also
  // the answer when the binding belongs to someone else (P-25).
  revokeAccountBinding(user: User, provider: string, subject: string): Promise<boolean>;
  revokeAgentBinding(user: User, agentUid: string): Promise<boolean>;
  // For the P-22a preview: what would remain afterwards.
  countAgentBindings(user: User): Promise<number>;
  // Whether a claim code would be accepted if presented now: unconsumed (P-7)
  // AND within its expiry where the deployment sets one (P-15). Answering from
  // consumption alone reports a route that has in fact expired, which is the
  // one thing P-22a's preview must not do.
  hasRedeemableClaimCode(user: User): Promise<boolean>;
};

export type RevocableStore<User extends { id: unknown }> = AccountLinkStore<User> &
  Partial<RevocationStore<User>>;

// What P-22a requires the preview to state: the recovery routes that survive.
export type RevocationPreview = {
  lastAccountBinding: boolean;
  remainingAccountBindings: number;
  redeemableClaimCode: boolean;
  remainingAgentBindings: number;
};

export type RevocationResult = {
  revoked: boolean;
  // Present only when confirmation is required, in which case NOTHING changed.
  preview: RevocationPreview | null;
  // A protocol state (P-25), or null when the call succeeded.
  code: string | null;
  // P-23: the acting browser's own agent binding went, so its stored
  // credential must be discarded. Never set by an account-binding revocation.
  clearCredential: boolean;
};

const REVOCATION_METHODS = [
  'listAccountBindings',
  'revokeAccountBinding',
  'revokeAgentBinding',
  'countAgentBindings',
  'hasRedeemableClaimCode',
] as const;

// Whether this store implements the optional revocation port. Consumers use it
// to decide whether to offer the revoke/list moves at all.
export const supportsRevocation = <User extends { id: unknown }>(
  store: RevocableStore<User>,
): store is AccountLinkStore<User> & RevocationStore<User> =>
  REVOCATION_METHODS.every((m) => typeof (store as Record<string, unknown>)[m] === 'function');

const requireRevocationStore = <User extends { id: unknown }>(
  store: RevocableStore<User>,
): AccountLinkStore<User> & RevocationStore<User> => {
  if (!supportsRevocation(store)) {
    const missing = REVOCATION_METHODS.filter(
      (m) => typeof (store as Record<string, unknown>)[m] !== 'function',
    );
    throw new Error(
      `persona: this store does not implement the revocation port (missing: ${missing.join(', ')}). ` +
        'Call supportsRevocation(store) before offering the revoke/list moves.',
    );
  }
  return store;
};

const previewFor = async <User extends { id: unknown }>(
  store: AccountLinkStore<User> & RevocationStore<User>,
  user: User,
  remainingAccountBindings: number,
): Promise<RevocationPreview> => ({
  lastAccountBinding: remainingAccountBindings === 0,
  remainingAccountBindings,
  redeemableClaimCode: await store.hasRedeemableClaimCode(user),
  remainingAgentBindings: await store.countAgentBindings(user),
});

// Removes one binding from the acting persona.
//
// Only the persona that holds a binding can revoke it (P-20), so every
// decision here is scoped to currentUser: a binding held by someone else is
// indistinguishable from one that does not exist (P-25). Revoking the last
// account binding is two-step (P-22) — the first call returns a preview and
// changes nothing, the caller re-sends with confirm.
//
// "Is this the last one" is evaluated on the call that would remove it, not
// carried over from an earlier response, which is the re-evaluation P-22 asks
// for: a binding that became the last one while the user was deciding gets a
// preview rather than a silent removal.
export type RevocationOptions<User extends { id: unknown }> = {
  currentUser: User | null;
  confirm?: boolean;
  store: RevocableStore<User>;
} & (
  | { target: { kind: 'account'; provider: string; subject: string } }
  // Required, not optional: clearCredential is decided by comparing this to
  // the target, so an adapter that forgets it silently reports "keep your
  // credential" for a browser that just revoked its own access. In the cookie
  // profile that signal is the only one — the client cannot clear the cookie
  // itself — so the failure would leave a live session for a persona this
  // browser no longer holds. Pass null to say "not this browser".
  | { target: { kind: 'agent'; agentUid: string }; actingAgentUid: string | null }
);

const notFound = (): RevocationResult => ({
  revoked: false,
  preview: null,
  code: BINDING_NOT_FOUND_CODE,
  clearCredential: false,
});

// TypeScript does not narrow the options union from the nested target.kind,
// so the discriminant is read through a predicate rather than a cast.
const isAgentCall = <User extends { id: unknown }>(
  opts: RevocationOptions<User>,
): opts is Extract<RevocationOptions<User>, { target: { kind: 'agent' } }> =>
  opts.target.kind === 'agent';

export const performRevocation = async <User extends { id: unknown }>(
  opts: RevocationOptions<User>,
): Promise<RevocationResult> => {
  const { currentUser, confirm = false } = opts;

  // P-8: identity decisions happen on credentialed requests. An anonymous
  // browser has no persona whose bindings it could revoke.
  if (!currentUser) {
    return { revoked: false, preview: null, code: NOT_JOINED_CODE, clearCredential: false };
  }

  const store = requireRevocationStore(opts.store);

  if (isAgentCall(opts)) {
    const { target, actingAgentUid } = opts;
    // P-23's counterpart to an account revocation: this removes one browser's
    // access, and is single-step — P-22 governs the last *account* binding.
    //
    // The ownership check is the kit's, not the store's: hasAgentBinding is
    // already required of every store, so scoping here means a store whose
    // delete forgets its user predicate still cannot revoke another persona's
    // browser (P-20).
    const removed = await store.withinTransaction(async () => {
      if (!(await store.hasAgentBinding(currentUser, target.agentUid))) return false;
      return store.revokeAgentBinding(currentUser, target.agentUid);
    });
    if (!removed) return notFound();
    return {
      revoked: true,
      preview: null,
      code: null,
      clearCredential: actingAgentUid === target.agentUid,
    };
  }

  const { target } = opts;

  // Read, decide and write in one atomic scope. Splitting them lets two
  // concurrent revocations each see a binding that is not the last, and
  // together take the last one without either showing a preview — exactly
  // what P-22 exists to prevent.
  return store.withinTransaction(async () => {
    const bindings = await store.listAccountBindings(currentUser);
    const held = bindings.some((b) => b.provider === target.provider && b.subject === target.subject);
    if (!held) return notFound();

    const remaining = bindings.length - 1;
    if (remaining === 0 && !confirm) {
      return {
        revoked: false,
        preview: await previewFor(store, currentUser, remaining),
        code: null,
        clearCredential: false,
      };
    }

    const removed = await store.revokeAccountBinding(currentUser, target.provider, target.subject);
    return removed ? { revoked: true, preview: null, code: null, clearCredential: false } : notFound();
  });
};
