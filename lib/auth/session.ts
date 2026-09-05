import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Who is using the product, for attribution and for the social features.
 *
 * Two ways in, and the difference between them matters.
 *
 * **Google** is a verified identity. The account is real and belongs to someone.
 *
 * **A handle** is a name someone typed, verified by nothing. It exists so the
 * product runs with no configuration at all, and the interface says plainly that
 * it is not a login.
 *
 * The session is signed either way. That was not needed while a handle was the
 * only option — the join screen said it protected nothing, and it did not. The
 * moment a Google account sits behind a session, a forgeable cookie becomes
 * worse than no identity at all, because people trust what looks verified. So
 * the cookie carries an HMAC and an unsigned or altered one is rejected rather
 * than believed.
 *
 * **None of this protects money.** OptionArena signs from one shared server
 * wallet; no session stands between a visitor and it. Signing in with Google
 * makes the *identity* real, not the custody safer, and the interface has to
 * keep saying so — a login invites people to assume otherwise.
 */

const COOKIE = 'optionarena_session';
const LEGACY_COOKIE = 'optionarena_handle';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Handles are lowercase: 3 to 20 characters, letters, digits, underscore. */
const HANDLE = /^[a-z0-9_]{3,20}$/;

export type Provider = 'google' | 'handle';

export interface Session {
  handle: string;
  provider: Provider;
}

/** The handle if it is one we accept, or null. Used on the way in and out. */
export function normaliseHandle(raw: string): string | null {
  const handle = raw.trim().toLowerCase().replace(/^@/, '');
  return HANDLE.test(handle) ? handle : null;
}

/**
 * The signing key.
 *
 * Absent, the product still runs: handle sessions fall back to the unsigned
 * cookie they have always used, which claims nothing it cannot deliver. Google
 * sign-in is refused instead, because a verified identity that cannot be signed
 * is the one combination that would actually mislead someone.
 */
function secret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= 16 ? value : null;
}

export function canSignSessions(): boolean {
  return secret() !== null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function verify(payload: string, signature: string, key: string): boolean {
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  // Length must match before timingSafeEqual, which throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The session this visitor holds, or null. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;

  if (raw) {
    const key = secret();
    const separator = raw.lastIndexOf('.');
    if (!key || separator === -1) return null;

    const payload = raw.slice(0, separator);
    if (!verify(payload, raw.slice(separator + 1), key)) return null;

    const [provider, handle] = payload.split(':');
    const clean = normaliseHandle(handle ?? '');
    if (!clean || (provider !== 'google' && provider !== 'handle')) return null;

    return { handle: clean, provider };
  }

  // Anyone signed in before sessions were signed keeps their handle rather than
  // being logged out mid-demo. Unsigned means unverified, and it is reported as
  // a handle, which is exactly what it is.
  const legacy = jar.get(LEGACY_COOKIE)?.value;
  const handle = legacy ? normaliseHandle(legacy) : null;
  return handle ? { handle, provider: 'handle' } : null;
}

/** The handle this visitor is using, or null. */
export async function getHandle(): Promise<string | null> {
  return (await getSession())?.handle ?? null;
}

export async function setSession(handle: string, provider: Provider): Promise<void> {
  const key = secret();
  const jar = await cookies();

  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };

  if (!key) {
    // Only reachable for handles: the Google routes refuse without a secret.
    jar.set(LEGACY_COOKIE, handle, options);
    return;
  }

  const payload = `${provider}:${handle}`;
  jar.set(COOKIE, `${payload}.${sign(payload, key)}`, options);
  jar.delete(LEGACY_COOKIE);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(LEGACY_COOKIE);
}
