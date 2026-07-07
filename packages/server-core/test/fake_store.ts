import type { AccountLinkStore } from '../src/account_link.js';

// In-memory implementation of the AccountLink storage port, mirroring the
// Ruby spec fake so both languages run the same conformance vectors.

export type FakeUser = { id: number };

type AgentBinding = { userId: number; agentUid: string; userAgent?: string };
type AccountBinding = { userId: number; provider: string; subject: string };

export class FakeAccountLinkStore implements AccountLinkStore<FakeUser> {
  users: FakeUser[] = [];
  agentBindings: AgentBinding[] = [];
  accountBindings: AccountBinding[] = [];
  private nextId = 0;

  async holderFor(provider: string, subject: string): Promise<FakeUser | null> {
    const binding = this.accountBindings.find((b) => b.provider === provider && b.subject === subject);
    return binding ? this.user(binding.userId) : null;
  }

  async withinTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  async createGuest(agentUid: string, userAgent?: string): Promise<FakeUser> {
    const guest = { id: ++this.nextId };
    this.users.push(guest);
    this.agentBindings.push({ userId: guest.id, agentUid, userAgent });
    return guest;
  }

  async addAccountBinding(user: FakeUser, provider: string, subject: string): Promise<void> {
    this.accountBindings.push({ userId: user.id, provider, subject });
  }

  async hasAgentBinding(user: FakeUser, agentUid: string): Promise<boolean> {
    return this.agentBindings.some((b) => b.userId === user.id && b.agentUid === agentUid);
  }

  async addAgentBinding(user: FakeUser, agentUid: string, userAgent?: string): Promise<void> {
    this.agentBindings.push({ userId: user.id, agentUid, userAgent });
  }

  async mergePreview(source: FakeUser, target: FakeUser): Promise<unknown> {
    return { sourceId: source.id, targetId: target.id };
  }

  async merge(source: FakeUser, target: FakeUser): Promise<void> {
    for (const b of this.agentBindings) if (b.userId === source.id) b.userId = target.id;
    for (const b of this.accountBindings) if (b.userId === source.id) b.userId = target.id;
    this.users = this.users.filter((u) => u.id !== source.id);
  }

  // Helpers for assertions (not part of the port).

  user(id: number): FakeUser | null {
    return this.users.find((u) => u.id === id) ?? null;
  }

  userForAgent(agentUid: string): FakeUser | null {
    const binding = this.agentBindings.find((b) => b.agentUid === agentUid);
    return binding ? this.user(binding.userId) : null;
  }
}
