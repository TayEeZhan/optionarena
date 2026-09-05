import 'server-only';

import { cookies } from 'next/headers';

/**
 * Who is using the product, for attribution and for the social features.
 *
 * This is a handle, not an account. There is no password and no verification,
 * because neither would protect anything here: OptionArena signs from one
 * shared server wallet, so a handle can never be the thing standing between a
 * visitor and the money. Adding credentials would mean storing them, which is a
 * real risk taken in exchange for a guarantee we cannot make.
 *
 * So the handle answers "whose strategy is this" and "who are my friends", and
 * the interface says plainly that it is not a login. If self-custody ever
 * arrives, the wallet address becomes the identity and this becomes a display
 * name — which is why `users.address` already sits alongside it in the schema.
 */

const COOKIE = 'optionarena_handle';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Handles are lowercase: 3 to 20 characters, letters, digits, underscore. */
const HANDLE = /^[a-z0-9_]{3,20}$/;

/** The handle if it is one we accept, or null. Used on the way in and out. */
export function normaliseHandle(raw: string): string | null {
  const handle = raw.trim().toLowerCase().replace(/^@/, '');
  return HANDLE.test(handle) ? handle : null;
}

/** The handle this visitor is using, or null when they have not claimed one. */
export async function getHandle(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  return raw ? normaliseHandle(raw) : null;
}

export async function setHandle(handle: string): Promise<void> {
  (await cookies()).set(COOKIE, handle, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearHandle(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
