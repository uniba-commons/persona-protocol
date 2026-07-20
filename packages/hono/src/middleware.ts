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
  // only types the 'persona' key. The built-in gates follow this key
  // automatically (see CONTEXT_KEY_VAR), so no shim middleware is needed.
  contextKey?: string;
};

// Where personaMiddleware records the context key it wrote to, so requireJoined
// and requirePersona read the same variable without the consumer repeating the
// option at every gate. Internal: namespaced to keep it out of an app's own
// context vars, and not part of PersonaEnv.
const CONTEXT_KEY_VAR = 'persona:contextKey';

const DEFAULT_CONTEXT_KEY = 'persona';

// The internal slot holds a *key name*, not a persona, so it is typed on its
// own Env rather than borrowing PersonaEnv's. Narrowing the context to this
// view keeps the cast at the boundary and self-describing: what is being
// asserted is "this context also carries the adapter's internal var".
type ContextKeyEnv = { Variables: { [CONTEXT_KEY_VAR]: string } };
const internal = (c: Context): Context<ContextKeyEnv> => c as unknown as Context<ContextKeyEnv>;

// The key a gate should read: an explicit per-gate override, else the key
// personaMiddleware recorded for this request, else the default. The fallback
// keeps a gate working when it runs without the middleware ahead of it — note
// it also applies when a gate runs *before* the middleware, which is a wiring
// bug rather than a supported arrangement; see requireJoined.
const contextKeyFor = (c: Context, override?: string): 'persona' =>
  (override ?? internal(c).get(CONTEXT_KEY_VAR) ?? DEFAULT_CONTEXT_KEY) as 'persona';

// Resolves the current persona from the session cookie once per request and
// puts it on c.var.persona (or opts.contextKey). Absence of a session, an
// invalid/expired cookie, or a null resolution all leave the request anonymous
// (P-1) — reads still work; writes are gated by requireJoined.
export const personaMiddleware = <P>(
  opts: PersonaMiddlewareOptions<P>,
): MiddlewareHandler<PersonaEnv<P>> => {
  const key = (opts.contextKey ?? DEFAULT_CONTEXT_KEY) as 'persona';
  return async (c, next) => {
    const session = await opts.cookies.readSession(c);
    const persona = session ? await opts.resolvePersona(session.sub, c) : null;
    internal(c).set(CONTEXT_KEY_VAR, key);
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
  // Context variable the gate reads the persona from. Only needed when the gate
  // runs without personaMiddleware ahead of it, or to override the key that
  // middleware recorded — a gate downstream of personaMiddleware already
  // follows its contextKey.
  contextKey?: string;
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
//
// Register this *after* personaMiddleware. A gate that runs before it sees no
// resolved persona and rejects every request, joined or not — true of any key,
// including the default, since the variable the gate reads has not been written
// yet.
export const requireJoined = <P = unknown>(
  opts: RequireJoinedOptions = {},
): MiddlewareHandler<PersonaEnv<P>> => {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    if (c.get(contextKeyFor(c, opts.contextKey))) return next();
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
    if (c.get(contextKeyFor(c, opts.contextKey))) return next();
    if (opts.allow?.(c)) return next();
    return rejectNotJoined(c, opts);
  };
};
