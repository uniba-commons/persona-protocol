// The claim decision table (docs/spec §6): binds a verified identity
// (provider + subject) — or any claim subject — to a persona. Mirrors the
// Ruby implementation (gems/persona/lib/persona/account_link.rb); both are
// checked against the same conformance vectors.
//
// All persistence goes through a storage port so the decision logic stays
// host-agnostic. User objects are the host's own; the only requirement is a
// stable `id`.

export type ClaimIdentity = {
  provider: string;
  subject: string;
};

export type AccountLinkStore<User extends { id: unknown }> = {
  // The persona currently bound to (provider, subject), if any.
  holderFor(provider: string, subject: string): Promise<User | null>;
  // Atomic scope for the mutating half of the decision table.
  withinTransaction<T>(fn: () => Promise<T>): Promise<T>;
  // A fresh persona already bound to agentUid, with the application's usual
  // join side effects run.
  createGuest(agentUid: string, userAgent?: string): Promise<User>;
  addAccountBinding(user: User, provider: string, subject: string): Promise<void>;
  hasAgentBinding(user: User, agentUid: string): Promise<boolean>;
  addAgentBinding(user: User, agentUid: string, userAgent?: string): Promise<void>;
  // MUST NOT change data (P-6). The preview value is opaque to the kit.
  mergePreview(source: User, target: User): Promise<unknown>;
  // Move all bindings and domain records from source to target, then retire
  // source (P-13).
  merge(source: User, target: User): Promise<void>;
};

export type AccountLinkResult<User> = {
  user: User;
  // Set only when the browser must persist a (new) agent_uid — i.e. the
  // anonymous cases (the credential-echo exception, H-3 / C-3).
  agentUid: string | null;
  merged: boolean;
  // Present only when confirmation is required, in which case NOTHING was
  // changed (P-6).
  mergePreview: unknown | null;
};

export const performAccountLink = async <User extends { id: unknown }>(opts: {
  identity: ClaimIdentity;
  currentUser: User | null;
  agentUid: string;
  userAgent?: string;
  confirmMerge?: boolean;
  store: AccountLinkStore<User>;
}): Promise<AccountLinkResult<User>> => {
  const { identity, currentUser, agentUid, userAgent, confirmMerge = false, store } = opts;

  let holder = await store.holderFor(identity.provider, identity.subject);

  // Conflict peek: the browser is joined as someone other than the subject's
  // current holder. Return the preview without touching data so the user can
  // still cancel; the client re-sends with confirmMerge.
  if (currentUser && holder && currentUser.id !== holder.id && !confirmMerge) {
    return {
      user: currentUser,
      agentUid: null,
      merged: false,
      mergePreview: await store.mergePreview(currentUser, holder),
    };
  }

  return store.withinTransaction(async () => {
    // Subject not yet linked to any persona: bind it to the acting persona,
    // creating a fresh guest first if the browser is anonymous.
    if (!holder) {
      holder = currentUser ?? (await store.createGuest(agentUid, userAgent));
      await store.addAccountBinding(holder, identity.provider, identity.subject);
    }

    let merged = false;
    if (currentUser && currentUser.id !== holder.id) {
      await store.merge(currentUser, holder);
      merged = true;
    }

    // Ensure this browser's agent_uid resolves to the holder. For a joined
    // browser that was just merged, merge already moved its binding; for an
    // anonymous browser adopting an existing holder, add it now.
    if (!(await store.hasAgentBinding(holder, agentUid))) {
      await store.addAgentBinding(holder, agentUid, userAgent);
    }

    return {
      user: holder,
      agentUid: currentUser ? null : agentUid,
      merged,
      mergePreview: null,
    };
  });
};
