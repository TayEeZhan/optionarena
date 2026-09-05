import { redirect } from 'next/navigation';
import { clearHandle, getHandle, normaliseHandle, setHandle } from '@/lib/auth/session';
import { getSocialStore } from '@/lib/social/store';

export const dynamic = 'force-dynamic';

/**
 * Claim a handle.
 *
 * Not a login, and the page says so rather than implying otherwise. There is no
 * password because a password here would protect nothing: OptionArena signs
 * from one shared server wallet, so a handle never stands between anyone and
 * the money. It exists so strategies have an author and friends have a name.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const current = await getHandle();
  const { error } = await searchParams;

  async function claim(formData: FormData) {
    'use server';

    const handle = normaliseHandle(String(formData.get('handle') ?? ''));
    if (!handle) redirect('/join?error=1');

    await setHandle(handle);
    await getSocialStore().upsertUser(handle);
    redirect('/friends');
  }

  async function signOut() {
    'use server';

    await clearHandle();
    redirect('/join');
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Your name here</p>
      <h1 className="display mt-2 text-[2.5rem] font-extrabold sm:text-[3rem]">
        {current ? 'Change your handle' : 'Pick a handle'}
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
        {current ? (
          <>
            You are <span className="data text-[var(--color-accent)]">@{current}</span>. Strategies
            you build are filed under this name.
          </>
        ) : (
          'So your strategies have an author, and your friends have someone to follow.'
        )}
      </p>

      <form action={claim} className="mt-8">
        <label htmlFor="handle" className="eyebrow">
          Handle
        </label>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-5 py-4 focus-within:border-[var(--color-accent)]/60">
          <span className="data text-[1.05rem] text-[var(--color-ink-faint)]">@</span>
          <input
            id="handle"
            name="handle"
            defaultValue={current ?? ''}
            placeholder="shengkuan"
            autoComplete="off"
            className="data w-full bg-transparent text-[1.05rem] outline-none placeholder:text-[var(--color-ink-faint)]"
          />
        </div>
        <p className="mt-2 text-[0.75rem] text-[var(--color-ink-faint)]">
          Three to twenty characters. Letters, numbers and underscores.
        </p>

        {error && (
          <p className="mt-3 text-[0.8rem] text-[var(--color-loss)]">
            That handle will not work. Use three to twenty letters, numbers or underscores.
          </p>
        )}

        <button type="submit" className="cta mt-6 min-h-14 w-full px-5 text-[0.95rem]">
          {current ? 'Save handle' : 'Continue'}
        </button>
      </form>

      {/*
       * Said here, once, and plainly. Anyone can type anyone's handle, and the
       * product must not let a user believe otherwise.
       */}
      <div className="mt-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5">
        <p className="text-[0.85rem] font-semibold">This is a name, not a login</p>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
          There is no password and nothing is verified, so anyone could type your handle. It labels
          strategies and builds a friends list. It does not protect anything, and it does not need
          to: OptionArena signs from one server wallet and you are never connecting your own.
        </p>
      </div>

      {current && (
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="w-full text-[0.8rem] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
          >
            Forget this handle on this device
          </button>
        </form>
      )}
    </div>
  );
}
