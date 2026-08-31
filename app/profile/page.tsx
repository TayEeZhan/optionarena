import { getStore } from '@/lib/db/store';
import { signerAddress, canSign, explorerTx } from '@/lib/thetanuts/client';

export const dynamic = 'force-dynamic';

/** The user's own executed history and track record. */
export default async function ProfilePage() {
  const strategies = await getStore().list(200);
  const executed = strategies.filter((s) => s.txHash);
  const address = signerAddress();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">My profile</p>
      <h1 className="display mt-2 text-4xl font-semibold">Your track record</h1>

      <div className="card mt-6 p-5">
        <p className="eyebrow">Trading wallet</p>
        {canSign() && address ? (
          <>
            <p className="data mt-2 break-all text-[0.95rem] text-[var(--color-ink)]">{address}</p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--color-ink-faint)]">
              OptionArena signs server-side. This is the shared wallet the app trades from, not a
              wallet you connected. See the README for why.
            </p>
          </>
        ) : (
          <p className="mt-2 text-[0.85rem] text-[var(--color-ink-muted)]">
            No signing key is configured, so this deployment runs in demo mode only.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label="Strategies built" value={String(strategies.length)} />
        <Tile label="Executed on-chain" value={String(executed.length)} />
        <Tile label="Simulated" value={String(strategies.length - executed.length)} />
      </div>

      {executed.length > 0 && (
        <ul className="mt-6 space-y-3">
          {executed.map((s) => (
            <li key={s.id} className="card p-4">
              <p className="display text-[0.95rem] font-medium">{s.label}</p>
              <a
                href={explorerTx(s.txHash!)}
                target="_blank"
                rel="noreferrer noopener"
                className="data mt-1 block truncate text-[0.72rem] text-[var(--color-lime)] hover:underline"
              >
                {s.txHash}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="data mt-1.5 text-2xl font-medium">{value}</p>
    </div>
  );
}
