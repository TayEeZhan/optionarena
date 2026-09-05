import { NextResponse, type NextRequest } from 'next/server';
import { fetchProfile, googleConfigured, handleSuggestion } from '@/lib/auth/google';
import { setSession } from '@/lib/auth/session';
import { getSocialStore } from '@/lib/social/store';
import { STATE_COOKIE } from '../route';

export const dynamic = 'force-dynamic';

/**
 * Where Google sends the user back.
 *
 * Every failure lands on /join with a short reason in the query string. The
 * reason is deliberately coarse — the detail goes to the server log, because a
 * provider's error text names our configuration and sometimes carries request
 * identifiers, and neither belongs in a URL the user can see or share.
 */
export async function GET(request: NextRequest) {
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/join?error=${reason}`, request.url));

  if (!googleConfigured()) return fail('google_unavailable');

  const url = request.nextUrl;

  // Google reports a refused consent here rather than as a failed exchange.
  if (url.searchParams.get('error')) return fail('google_cancelled');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expected || state !== expected) {
    return fail('google_state');
  }

  let handle: string;
  try {
    const profile = await fetchProfile(code, url.origin);
    handle = await getSocialStore().upsertGoogleUser(
      {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
      handleSuggestion(profile.email),
    );
  } catch (error) {
    console.error('[auth] Google sign-in failed:', error);
    return fail('google_failed');
  }

  await setSession(handle, 'google');

  const response = NextResponse.redirect(new URL('/friends', request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
