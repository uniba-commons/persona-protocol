import type { Context, MiddlewareHandler } from 'hono';
import { NOT_JOINED_CODE } from '@uniba-commons/persona-server-core';
import type { PersonaCookies } from './cookies.js';

// The Hono Env this adapter populates: the resolved persona (or null) lives at
// c.var.persona. Consumers type their app as `new Hono<PersonaEnv<MyUser>>()`.
export type PersonaEnv<P> = { Variables: { persona: P | null } };

export type PersonaMiddlewareOptions<P> = {
  cookies: PersonaCookies;
  // Resolves the session's persona reference to the app's own user object.
  // Returning null (e.g. a deleted persona) is treated as un-joined.
  resolvePersona: (sub: string, c: Context) => Promise<P | null> | P | null;
};

// Resolves the current persona from the session cookie once per request and
// puts it on c.var.persona. Absence of a session, an invalid/expired cookie,
// or a null resolution all leave the request anonymous (P-1) — reads still
// work; writes are gated by requireJoined.
export const personaMiddleware = <P>(
  opts: PersonaMiddlewareOptions<P>,
): MiddlewareHandler<PersonaEnv<P>> => {
  return async (c, next) => {
    const session = await opts.cookies.readSession(c);
    const persona = session ? await opts.resolvePersona(session.sub, c) : null;
    c.set('persona', persona ?? null);
    await next();
  };
};

// Methods that never require a persona: reads stay anonymous (P-1).
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type RequireJoinedOptions = {
  // Writes a not-yet-joined browser may still perform: the join flow itself,
  // claim redemption, and similar bootstrap actions (C-4). Return true to let
  // the request through.
  allow?: (c: Context) => boolean;
  // Where to send a full-page navigation that is rejected. When set, an
  // un-joined write from a browser that accepts HTML is redirected here (the
  // server-rendered NOT_JOINED shape). Otherwise a machine-readable response
  // is returned.
  redirectTo?: string;
  // Full override of the rejection response (e.g. an htmx fragment carrying a
  // join affordance). Takes precedence over redirectTo.
  onNotJoined?: (c: Context) => Response | Promise<Response>;
};

const acceptsHtml = (c: Context): boolean => (c.req.header('accept') ?? '').includes('text/html');

// Gates un-joined writes with the NOT_JOINED signal (P-2 / C-4). Reads pass
// through untouched (P-1); joined browsers and allowlisted writes pass through;
// everything else is rejected in the shape the caller expects — a redirect for
// full-page navigation, or a machine-readable `{ code: "NOT_JOINED" }` for
// scripted callers.
export const requireJoined = <P = unknown>(
  opts: RequireJoinedOptions = {},
): MiddlewareHandler<PersonaEnv<P>> => {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    if (c.get('persona')) return next();
    if (opts.allow?.(c)) return next();

    if (opts.onNotJoined) return opts.onNotJoined(c);
    if (opts.redirectTo && acceptsHtml(c)) return c.redirect(opts.redirectTo);
    return c.json({ code: NOT_JOINED_CODE }, 401);
  };
};
