import 'server-only';

import { canSignSessions } from './session';

/**
 * Sign in with Google, as the plain authorization-code flow.
 *
 * Rolled directly rather than through an auth library, because the library
 * would bring its own identity model and its own tables, and all we need is a
 * verified email address attached to the handle the social features already
 * key on.
 *
 * No token is parsed or validated here. The code is exchanged server-side with
 * the client secret, and the profile is then read from Google's userinfo
 * endpoint over TLS — so there is no signature for us to get wrong.
 */

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleProfile {
  /** Google's stable id for the account. Never the email, which can change. */
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Whether Google sign-in can work on this deployment.
 *
 * `AUTH_SECRET` counts: without it a session cannot be signed, and an unsigned
 * session behind a verified account is the one combination we will not ship.
 */
export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && canSignSessions(),
  );
}

/**
 * Where Google should send the user back to.
 *
 * Derived from the request rather than configured, so one build works on
 * localhost, on a Vercel preview and in production without a variable that can
 * drift out of date. It must match a redirect URI registered in the Google
 * console exactly, including the scheme.
 */
export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Ask every time rather than silently reusing an account, so anyone
    // demonstrating this can switch between two accounts on one machine.
    prompt: 'select_account',
  });

  return `${AUTHORIZE}?${params}`;
}

/** Exchange the one-time code for a token, then read the profile. */
export async function fetchProfile(code: string, origin: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    // The status separates a wrong secret from an unregistered redirect URI.
    // It goes to the server log, never to the browser.
    throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) throw new Error('Google returned no access token.');

  const profileResponse = await fetch(USERINFO, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!profileResponse.ok) {
    throw new Error(`Google userinfo failed: ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error('Google returned a profile with no id or email.');
  }

  // An unverified address can be claimed by someone else later, so it is not
  // an identity we are willing to attach strategies to.
  if (profile.email_verified === false) {
    throw new Error('That Google address is not verified.');
  }

  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
  };
}

/**
 * A handle from an email address.
 *
 * Handles stay the key the social features join on, so a Google account needs
 * one. The local part is only a starting point: it can collide, be too short,
 * or contain characters a handle does not allow, so the caller resolves the
 * final name against what is already taken.
 */
export function handleSuggestion(email: string): string {
  const local = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  if (local.length >= 3) return local.slice(0, 20);
  return `${local}user`.slice(0, 20);
}
