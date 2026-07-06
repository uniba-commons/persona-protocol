import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createSessionCodec, type SessionPayload } from '@uniba-commons/persona-server-core';

// Binds persona-protocol's cookie-profile credential to Hono. Two signed cookies:
//
//   session  — the credential itself (C-1/C-2/C-3): a reference to the persona,
//              issued only at acquisition and read on every request.
//   pending  — the short-lived propose-stage cookie (P-10): a validated-but-not-
//              yet-committed join, held until the user confirms.
//
// Both are signed by persona-server-core's Web-Crypto codec, so this module
// runs unchanged on Node, edge runtimes, and workers. Cookie attributes live
// here because they are the framework's concern; the invariants they satisfy
// (HttpOnly, Secure over https, SameSite) are C-2.

export type PersonaCookieOptions = {
  // HMAC secret shared with any other cookie-profile surface of the same app.
  secret: string;
  // Cookie names. Defaults are namespaced to avoid collisions.
  sessionCookie?: string;
  pendingCookie?: string;
  // Lifetimes. Session defaults to a year (the browser stays "you" until it
  // forgets); pending to an hour (time to read the welcome screen and decide).
  sessionTtlSeconds?: number;
  pendingTtlSeconds?: number;
  // C-2: MUST be Secure over https. Defaults to true; set false only for local
  // plain-http development.
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
};

// The session references the persona (`sub`) and MAY carry a per-browser id
// (`bid`, C-5) used only as metadata for a "browsers using this persona" list.
export type SessionData = { sub: string; bid?: string };

export type PersonaCookies = {
  setSession(c: Context, data: SessionData): Promise<void>;
  readSession(c: Context): Promise<(SessionData & SessionPayload) | null>;
  clearSession(c: Context): void;
  setPending<T extends Record<string, unknown>>(c: Context, data: T): Promise<void>;
  readPending<T extends Record<string, unknown>>(c: Context): Promise<(T & SessionPayload) | null>;
  clearPending(c: Context): void;
};

const YEAR = 60 * 60 * 24 * 365;
const HOUR = 60 * 60;

export const createPersonaCookies = (opts: PersonaCookieOptions): PersonaCookies => {
  const codec = createSessionCodec({ secret: opts.secret });
  const sessionCookie = opts.sessionCookie ?? 'persona_session';
  const pendingCookie = opts.pendingCookie ?? 'persona_pending';
  const sessionTtl = opts.sessionTtlSeconds ?? YEAR;
  const pendingTtl = opts.pendingTtlSeconds ?? HOUR;
  const secure = opts.secure ?? true;
  const sameSite = opts.sameSite ?? 'Lax';
  const path = opts.path ?? '/';

  const attrs = (maxAge: number) => ({ httpOnly: true, secure, sameSite, path, maxAge });

  return {
    async setSession(c, data) {
      const token = await codec.sign(data, sessionTtl);
      setCookie(c, sessionCookie, token, attrs(sessionTtl));
    },
    async readSession(c) {
      return codec.verify<SessionData & SessionPayload>(getCookie(c, sessionCookie));
    },
    clearSession(c) {
      deleteCookie(c, sessionCookie, { path });
    },

    async setPending(c, data) {
      const token = await codec.sign(data, pendingTtl);
      setCookie(c, pendingCookie, token, attrs(pendingTtl));
    },
    async readPending(c) {
      return codec.verify(getCookie(c, pendingCookie)) as never;
    },
    clearPending(c) {
      deleteCookie(c, pendingCookie, { path });
    },
  };
};
