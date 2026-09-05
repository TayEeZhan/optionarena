import { redirect } from 'next/navigation';
import { GoogleMark } from '@/components/Icons';
import { googleConfigured } from '@/lib/auth/google';
import { clearSession, getSession, normaliseHandle, setSession } from '@/lib/auth/session';
import { getSocialStore } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  handle: 'That handle will not work. Use three to twenty letters, numbers or underscores.',
  google_unavailable: 'Google sign-in is not configured on this deployment.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'That sign-in link had expired. Try again from this page.',
  google_failed: 'Google sign-in could not be completed. Try again in a moment.',
};

/**
 * Sign in.
 *
 * Two ways, and the page is honest about the gap between them. Google is a
 * verified account. A handle is a name someone typed, which is enough to label
 * a strategy and build a friends list and is not a login — so it stays, because
 * it means the product runs with no configuration at all.
 *
 * Neither protects money. One server wallet signs everything, and a person who
 * has just logged in is exactly the person most likely to assume otherwise,
 * which is why the notice sits under both buttons rather than only under one.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;
  const google = googleConfigured();

  async function claim(formData: FormData) {
    'use server';

    const handle = normaliseHandle(String(formData.get('handle') ?? ''));
    if (!handle) redirect('/join?error=handle');

    await setSession(handle, 'handle');
    await getSocialStore().upsertUser(handle);
    redirect('/friends');
  }

  async function signOut() {
    'use server';

    await clearSession();
    redirect('/join');
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Your name here</p>
      <h1 className="display mt-2 text-[2.5rem] font-extrabold sm:text-[3rem]">
        {session ? 'You are signed in' : 'Sign in'}
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
        {session ? (
          <>
            You are <span className="data text-[var(--color-accent)]">@{session.handle}</span>
            {session.provider === 'google'
              ? ', verified with Google.'
              : ', using an unverified handle.'}{' '}
            Strategies you build are filed under this name.
          </>
        ) : (
          'So your strategies have an author, and your friends have someone to follow.'
        )}
      </p>

      {error && ERRORS[error] && (
        <p className="mt-5 rounded-2xl border border-[var(--color-loss)]/30 bg-[var(--color-loss)]/[0.06] px-4 py-3 text-[0.8rem] leading-relaxed text-[var(--color-loss)]">
          {ERRORS[error]}
        </p>
      )}

      {google ? (
        <a
          href="/api/auth/google"
          className="mt-7 flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-5 text-[0.95rem] font-semibold text-[#1f1f1f] transition-opacity hover:opacity-90"
        >
          <GoogleMark className="h-5 w-5" />
          Continue with Google
        </a>
      ) : (
        <div className="mt-7 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5">
          <p className="text-[0.85rem] font-semibold">Google sign-in is off here</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
            This deployment has no Google credentials configured, so use a handle below. Everything
            else works the same.
          </p>
        </div>
      )}

      <div className="mt-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-[var(--color-hairline)]" />
        <span className="eyebrow">or use a handle</span>
        <span className="h-px flex-1 bg-[var(--color-hairline)]" />
      </div>

      <form action={claim} className="mt-6">
        <label htmlFor="handle" className="eyebrow">
          Handle
        </label>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-5 py-4 focus-within:border-[var(--color-accent)]/60">
          <span className="data text-[1.05rem] text-[var(--color-ink-faint)]">@</span>
          <input
            id="handle"
            name="handle"
            defaultValue={session?.handle ?? ''}
            placeholder="shengkuan"
            autoComplete="off"
            className="data w-full bg-transparent text-[1.05rem] outline-none placeholder:text-[var(--color-ink-faint)]"
          />
        </div>
        <p className="mt-2 text-[0.75rem] text-[var(--color-ink-faint)]">
          Three to twenty characters. Letters, numbers and underscores.
        </p>

        <button type="submit" className="ghost mt-5 min-h-14 w-full px-5 text-[0.95rem]">
          {session ? 'Use this handle instead' : 'Continue with a handle'}
        </button>
      </form>

      {/*
       * Under both buttons, not just the handle. Someone who has just signed in
       * with a real account is the person most likely to assume the account
       * protects the money, and it does not.
       */}
      <div className="mt-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5">
        <p className="text-[0.85rem] font-semibold">Signing in does not hold your money</p>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
          OptionArena signs every trade from one shared server wallet, and you never connect your
          own. An account tells the product who built which strategy and who your friends are. It is
          not a wallet, and it is not custody.
        </p>
        <p className="mt-3 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
          A handle is checked against nothing, so anyone could type yours. Google verifies that the
          account is really yours.
        </p>
      </div>

      {session && (
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="w-full text-[0.8rem] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
          >
            Sign out on this device
          </button>
        </form>
      )}
    </div>
  );
}
