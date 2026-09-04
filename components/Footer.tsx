import Link from 'next/link';

/**
 * The quiet footer.
 *
 * It exists for two reasons, both about things that must not be hidden.
 *
 * The bottom bar holds five destinations, which is as many as a phone can carry
 * without becoming unreadable. That left `/feed` and `/profile` unreachable:
 * nothing in the interface linked to either. `/feed` is where transaction
 * hashes live, and a hash nobody can navigate to proves nothing.
 *
 * `/profile` was worse. It is the only screen that states how custody actually
 * works, and the header banner saying so appears only when no signing key is
 * configured — so on a deployment that CAN sign, the disclosure disappeared
 * exactly when it mattered most.
 *
 * The custody line below is therefore unconditional. It is not a fallback and
 * does not depend on server state. See the PRD non-negotiables: never hide the
 * custody limitation.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--color-hairline)] pt-6">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Secondary">
        <Link
          href="/feed"
          className="text-[0.82rem] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          Strategy feed
        </Link>
        <Link
          href="/profile"
          className="text-[0.82rem] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          Your history
        </Link>
      </nav>

      <p className="mx-auto mt-4 max-w-md text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
        OptionArena signs from one server wallet. You are not connecting your own, and this is a
        product demonstration rather than self-custody.
      </p>
    </footer>
  );
}
