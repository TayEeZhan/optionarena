import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authorizeUrl, googleConfigured } from '@/lib/auth/google';

export const dynamic = 'force-dynamic';

export const STATE_COOKIE = 'optionarena_oauth_state';

/**
 * Start signing in with Google.
 *
 * The `state` value is random, stored in a short-lived cookie and compared on
 * the way back. Without it, someone could hand a victim a prepared callback URL
 * and sign them into an account they do not own.
 */
export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/join?error=google_unavailable', request.url));
  }

  const state = randomBytes(16).toString('base64url');
  const response = NextResponse.redirect(authorizeUrl(request.nextUrl.origin, state));

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  return response;
}
