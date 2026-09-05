import Link from 'next/link';
import { BattleResultOverlay } from '@/components/BattleResultOverlay';
import { notFound } from 'next/navigation';
import { getHandle } from '@/lib/auth/session';
import { getStore } from '@/lib/db/store';
import { resolveIfDue } from '@/lib/social/battles';
import { getSocialStore } from '@/lib/social/store';
import type { ExecutedStrategy } from '@/lib/agent/schema';

export const dynamic = 'force-dynamic';

/**
 * One battle, head to head.
 *
 * Before expiry this compares conviction: what each side risked, and what each
 * pays if they are right. Those numbers are already on the strategy rows, so
 * the card needs no price feed and is honest about being a comparison rather
 * than a score. After expiry it shows the real result, settled against the
 * price Deribit published. See `lib/social/battles.ts`.
 */
export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getSocialStore().getBattle(id);
  if (!battle) notFound();

  const me = await getHandle();
  const store = getStore();
  const [challengerStrategy, opponentStrategy] = await Promise.all([
    store.get(battle.challengerStrategyId),
    store.get(battle.opponentStrategyId),
  ]);

  const outcome = await resolveIfDue(battle, challengerStrategy, opponentStrategy);
  const resolved = outcome.battle.winner;
  const resolvesOn = new Date(battle.resolvesAt * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  // Only a participant gets the moment, and only once per browser.
  const mine = me ? resultFor(resolved, me) : null;

  return (
    <div className="mx-auto max-w-xl">
      {mine && <BattleResultOverlay battleId={battle.id} outcome={mine} />}

      <Link
        href="/battles"
        className="text-[0.82rem] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        ← Battles
      </Link>

      <div className="mt-5 flex items-start justify-between gap-4">
        <h1 className="display text-[2.4rem] font-extrabold">
          @{battle.challenger} <span className="text-[var(--color-ink-faint)]">vs</span> @
          {battle.opponent}
        </h1>
        <span
          className={`pill mt-2 shrink-0 px-3 py-1.5 text-[0.7rem] font-semibold ${
            resolved ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)]'
          }`}
        >
          {resolved ? 'Settled' : 'Running'}
        </span>
      </div>

      {resolved ? (
        <div className="panel accent-ring mt-6 p-6 text-center">
          <p className="eyebrow">Result</p>
          <p className="display mt-2 text-[2.2rem] font-extrabold">
            {resolved === 'draw' ? 'A draw.' : `@${resolved} wins.`}
          </p>
          <p className="mt-3 text-[0.82rem] leading-relaxed text-[var(--color-ink-muted)]">
            Settled against the price Deribit published for that expiry
            {outcome.battle.settlement
              ? `: ${Object.entries(outcome.battle.settlement)
                  .map(([symbol, price]) => `${symbol} ${price.toLocaleString('en-US')}`)
                  .join(', ')}`
              : ''}
            . Nothing here is self-reported.
          </p>
        </div>
      ) : (
        <div className="panel mt-6 p-5 text-center">
          <p className="text-[0.9rem] font-semibold">Resolves {resolvesOn}</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
            {outcome.note ??
              'Neither side has won yet. An option has no result until it expires, so until then this compares what each of you risked and what each pays if you are right — not who is ahead.'}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Side
          handle={battle.challenger}
          strategy={challengerStrategy}
          pnl={outcome.pnl?.challenger ?? null}
          result={resultFor(resolved, battle.challenger)}
          isMe={me === battle.challenger}
        />
        <Side
          handle={battle.opponent}
          strategy={opponentStrategy}
          pnl={outcome.pnl?.opponent ?? null}
          result={resultFor(resolved, battle.opponent)}
          isMe={me === battle.opponent}
        />
      </div>

      <p className="mt-8 text-center text-[0.72rem] leading-relaxed text-[var(--color-ink-faint)]">
        Nothing is staked on a battle and no money changes hands. Both positions belong entirely to
        the person who built them.
      </p>
    </div>
  );
}

type SideResult = 'won' | 'lost' | 'drew' | null;

/**
 * How one side finished.
 *
 * Three states, not a boolean. A draw is not a loss, and treating "did not win"
 * as "lost" told both players they had lost the same battle.
 */
function resultFor(winner: string | null, handle: string): SideResult {
  if (!winner) return null;
  if (winner === 'draw') return 'drew';
  return winner === handle ? 'won' : 'lost';
}

function Side({
  handle,
  strategy,
  pnl,
  result,
  isMe,
}: {
  handle: string;
  strategy: ExecutedStrategy | null;
  pnl: number | null;
  result: SideResult;
  isMe: boolean;
}) {
  if (!strategy) {
    return (
      <div className="panel p-5 text-[0.85rem] text-[var(--color-ink-faint)]">
        @{handle}&rsquo;s strategy is no longer on record.
      </div>
    );
  }

  return (
    <div
      className={`panel p-5 ${result === 'won' ? 'accent-ring' : ''} ${
        result === 'lost' ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="data text-[0.95rem] font-semibold">
          @{handle}
          {isMe && (
            <span className="ml-1.5 text-[0.7rem] font-normal text-[var(--color-ink-faint)]">
              (you)
            </span>
          )}
        </p>
        {result && (
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold ${
              result === 'won'
                ? 'border-[var(--color-gain)]/40 text-[var(--color-gain)]'
                : 'border-[var(--color-hairline-bright)] text-[var(--color-ink-faint)]'
            }`}
          >
            {result === 'won' ? 'Won' : result === 'drew' ? 'Drew' : 'Lost'}
          </span>
        )}
      </div>

      <p className="mt-3 text-[1rem] font-bold">{strategy.label}</p>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
        &ldquo;{strategy.view}&rdquo;
      </p>

      <dl className="mt-4 space-y-2 text-[0.78rem]">
        <Row label="Risked" value={`${strategy.maxLoss} ${strategy.collateralSymbol}`} />
        <Row label="Pays if right" value={strategy.maxGain ?? 'Unbounded'} />
        <Row
          label="Breakeven"
          value={strategy.breakeven === null ? '—' : strategy.breakeven.toLocaleString('en-US')}
        />
        {result && pnl !== null && (
          <Row
            label="Settled at"
            value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ${strategy.collateralSymbol}`}
            tone={pnl >= 0 ? 'gain' : 'loss'}
          />
        )}
      </dl>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  const colour =
    tone === 'gain'
      ? 'text-[var(--color-gain)]'
      : tone === 'loss'
        ? 'text-[var(--color-loss)]'
        : 'text-[var(--color-ink-muted)]';

  return (
    <div className="flex justify-between gap-3 border-b border-[var(--color-hairline)] pb-2 last:border-0">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className={`data text-right ${colour}`}>{value}</dd>
    </div>
  );
}
