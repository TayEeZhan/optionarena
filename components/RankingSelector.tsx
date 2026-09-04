'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WINNING_CRITERIA, type WinningCriterion } from '@/lib/signals/types';

export function RankingSelector({ value }: { value: WinningCriterion }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(next: WinningCriterion) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('criterion', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="block">
      <span className="sr-only">Ranking criterion</span>
      <select
        value={value}
        onChange={(event) => select(event.target.value as WinningCriterion)}
        className="pill w-full appearance-none px-5 py-3.5 text-[0.9rem] font-medium text-[var(--color-ink)] outline-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' stroke='%239aa89e' stroke-width='1.8'%3E%3Cpath d='m5 7 4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 1rem center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {(Object.entries(WINNING_CRITERIA) as [WinningCriterion, { label: string }][]).map(
          ([key, criterion]) => (
            <option key={key} value={key}>
              Ranking: {criterion.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
