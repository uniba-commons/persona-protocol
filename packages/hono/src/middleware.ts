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
  // Context variable the resolved persona is written to. Defaults to 'persona'
  // (matching PersonaEnv). Set it to reuse an app's existing key — e.g. 'user'
  // for an app whose routes already read `c.get('user')` — without renaming
  // call sites. With a custom key, type your app's Env yourself: PersonaEnv
  // only types the 'persona' key. The one-line alternative to a custom key is a
  // shim middleware after this one: `c.set('user', c.get('persona'))`.
  contextKey?: string;
};

// Resolves the current persona from the session cookie once per request and
// puts it on c.var.persona (or opts.contextKey). Absence of a session, an
// invalid/expired cookie, or a null resolution all leave the request anonymous
// (P-1) — reads still work; writes are gated by requireJoined.
export const personaMiddleware = <P>(
  opts: PersonaMiddlewareOptions<P>,
): MiddlewareHandler<PersonaEnv<P>> => {
  const key = (opts.contextKey ?? 'persona') as 'persona';
  return async (c, next) => {
    const session = await opts.cookies.readSession(c);
    const persona = session ? await opts.resolvePersona(session.sub, c) : null;
    c.set(key, persona ?? null);
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

// Rejects a request that has no persona, in the shape the caller expects: a
// full override, then a redirect for full-page navigation, else a machine-
// readable `{ code: "NOT_JOINED" }`. Shared by requireJoined and requirePersona.
const rejectNotJoined = (
  c: Context,
  opts: RequireJoinedOptions,
): Response | Promise<Response> => {
  if (opts.onNotJoined) return opts.onNotJoined(c);
  if (opts.redirectTo && acceptsHtml(c)) return c.redirect(opts.redirectTo);
  return c.json({ code: NOT_JOINED_CODE }, 401);
};

// Gates un-joined *writes* with the NOT_JOINED signal (P-2 / C-4). Reads pass
// through untouched (P-1, "reads are public, writes need a join"); joined
// browsers and allowlisted writes pass through; everything else is rejected by
// rejectNotJoined. For routes whose *reads* are also owner-only (a private
// settings or profile page that must redirect an anonymous browser even on
// GET), reach for requirePersona instead — which of your routes are private is
// the consumer's policy, and the adapter only enforces the gate you attach.
export const requireJoined = <P = unknown>(
  opts: RequireJoinedOptions = {},
): MiddlewareHandler<PersonaEnv<P>> => {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    if (c.get('persona')) return next();
    if (opts.allow?.(c)) return next();
    return rejectNotJoined(c, opts);
  };
};

// Gates *reads and writes*: every method requires a resolved persona. This is
// the read-gate requireJoined deliberately is not — attach it to owner-only
// routes (a `/settings` page, a profile editor, a personal list) that must not
// be served to an anonymous browser even on GET. Rejection uses the same shape
// as requireJoined, so an HTML navigation redirects to the join flow while a
// scripted read gets `{ code: "NOT_JOINED" }`. Use `allow` to exempt the join
// page itself (an owner-only section whose entry point is public).
export const requirePersona = <P = unknown>(
  opts: RequireJoinedOptions = {},
): MiddlewareHandler<PersonaEnv<P>> => {
  return async (c, next) => {
    if (c.get('persona')) return next();
    if (opts.allow?.(c)) return next();
    return rejectNotJoined(c, opts);
  };
};
