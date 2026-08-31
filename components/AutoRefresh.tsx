'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps server-rendered market data current without a full page load.
 *
 * `router.refresh()` re-runs the server components and leaves client state
 * alone, so the market pulse updates while a half-finished strategy on screen
 * is untouched. It matters on demo day: resting orders expire in minutes, and a
 * stale pulse makes a live product look dead.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Refreshing a hidden tab wastes indexer calls and achieves nothing.
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };

    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, seconds]);

  return null;
}
