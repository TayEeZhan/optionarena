'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useMode } from './ModeProvider';
import { PayoffChart } from './PayoffChart';
import { ProofPanel } from './ProofPanel';
import { WalletTrade } from './WalletTrade';
import { useWallet } from './WalletProvider';
import type { InterpretResponse, ExecuteResponse } from '@/lib/wire';
import type { RiskLevel } from '@/lib/agent/schema';

/** The four steps, reflected in the progress indicator. */
const STEPS = ['Describe', 'Preview risk', 'Prove on-chain', 'Share'] as const;

const EXAMPLES = [
  'ETH drops below 2,200 this week',
  'BTC stays flat, I want cheap downside cover',
  'ETH sells off hard into the weekend',
];

const RISKS: { value: RiskLevel; label: string; hint: string }[] = [
  { value: 'conservative', label: 'Steady', hint: 'Closer strike, longer expiry' },
  { value: 'balanced', label: 'Balanced', hint: 'A moderate distance out' },
  { value: 'aggressive', label: 'Punchy', hint: 'Further out, pays more if right' },
];

/**
 * `initialView` seeds step 01 so a sourced trade can hand its market view over
 * from /copy. It is a starting sentence, not a decision: the agent still reads
 * it against the live book and the user still approves the maximum loss.
 */
export function Flow({
  initialView = '',
  initialBudget = 5,
}: {
  initialView?: string;
  initialBudget?: number;
}) {
  const { mode } = useMode();

  const [step, setStep] = useState(0);
  const [view, setView] = useState(initialView);
  const [budget, setBudget] = useState(initialBudget);
  const [risk, setRisk] = useState<RiskLevel>('balanced');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [execution, setExecution] = useState<ExecuteResponse | null>(null);

  async function interpretView() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ view, budget, risk }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not price that view.');
      const interpreted = data as InterpretResponse;
      setResult(interpreted);
      setStep(1);

      if (interpreted.confidence < 0.3) {
        toast.warning('Weak match', {
          description: 'The agent is not confident this contract fits your view. Read why.',
          duration: 7000,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  async function executeStrategy() {
    if (!result) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instrumentId: result.quote.instrumentId,
          budget,
          mode,
          view,
          risk,
          reasoning: result.reasoning,
          direction: result.direction,
          approvedMaxLoss: result.quote.maxLoss,
          approvedContracts: result.quote.numContracts,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The trade could not be placed.');
      const outcome = data as ExecuteResponse;
      setExecution(outcome);
      setStep(2);

      if (outcome.live) {
        toast.success('Filled on Base', {
          description: `${outcome.spentDisplay} spent. Transaction hash is on screen.`,
          duration: 8000,
        });
      } else {
        toast('Simulated', {
          description: 'Real prices, no signature. Nothing moved.',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setStep(0);
    setResult(null);
    setExecution(null);
    setError(null);
  }

  return (
    <div>
      <Progress current={step} />

      {error && (
        <div className="mb-5 rounded-2xl border border-[var(--color-loss)]/40 bg-[var(--color-loss)]/8 px-5 py-4">
          <p className="eyebrow text-[var(--color-loss)]">Stopped</p>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed">{error}</p>
        </div>
      )}

      {step === 0 && (
        <DescribeStep
          view={view}
          setView={setView}
          budget={budget}
          setBudget={setBudget}
          risk={risk}
          setRisk={setRisk}
          pending={pending}
          onSubmit={interpretView}
        />
      )}

      {step === 1 && result && (
        <PreviewStep
          result={result}
          mode={mode}
          budget={budget}
          pending={pending}
          onBack={() => setStep(0)}
          onExecute={executeStrategy}
        />
      )}

      {step >= 2 && execution && result && (
        <ProofPanel execution={execution} quote={result.quote} onStartOver={startOver} />
      )}
    </div>
  );
}

/**
 * Where you are in the flow.
 *
 * A phone has no room for four labelled steps side by side, so small screens
 * get the current step named plus a progress bar. The full list appears from
 * `sm` up.
 */
function Progress({ current }: { current: number }) {
  const pct = ((current + 1) / STEPS.length) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between sm:hidden">
        <p className="text-[0.95rem] font-semibold">{STEPS[current]}</p>
        <p className="data text-[0.75rem] text-[var(--color-ink-faint)]">
          {String(current + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </p>
      </div>
      <div
        className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--color-hairline)] sm:hidden"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label="Progress"
      >
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="hidden sm:flex sm:items-center sm:gap-2.5">
        {STEPS.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={`data flex h-7 w-7 items-center justify-center rounded-full text-[0.72rem] font-medium ${
                  active
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                    : done
                      ? 'bg-[var(--color-surface-high)] text-[var(--color-accent-bright)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink-faint)]'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`text-[0.85rem] ${
                  active ? 'font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
                }`}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <span className="ml-1 h-px w-5 bg-[var(--color-hairline-bright)]" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DescribeStep({
  view,
  setView,
  budget,
  setBudget,
  risk,
  setRisk,
  pending,
  onSubmit,
}: {
  view: string;
  setView: (v: string) => void;
  budget: number;
  setBudget: (v: number) => void;
  risk: RiskLevel;
  setRisk: (v: RiskLevel) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="card p-6 sm:p-8">
      <h2 className="display text-[2.1rem] font-extrabold sm:text-[2.6rem]">
        What do you think happens?
      </h2>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
        Write it in your own words. The agent turns it into a contract with a fixed maximum loss.
      </p>

      <textarea
        value={view}
        onChange={(e) => setView(e.target.value)}
        rows={3}
        aria-label="Your market view"
        placeholder="ETH drops below 2,200 before the weekend"
        className="mt-6 w-full resize-none rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-5 py-4 text-[1.05rem] leading-relaxed outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]/60"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setView(example)}
            className="rounded-full border border-[var(--color-hairline-bright)] px-3.5 py-2 text-left text-[0.8rem] text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <label className="eyebrow" htmlFor="budget">
            Maximum spend
          </label>
          <div className="mt-2.5 flex items-baseline gap-2 rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-5 py-4">
            <input
              id="budget"
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={budget}
              onChange={(e) => setBudget(Math.max(1, Number(e.target.value)))}
              className="data w-full bg-transparent text-3xl font-medium outline-none"
            />
            <span className="data shrink-0 text-[0.85rem] text-[var(--color-ink-faint)]">USDC</span>
          </div>
          <p className="mt-2.5 text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
            This is the most you can lose. Nothing can take more.
          </p>
        </div>

        <div>
          <span className="eyebrow">Risk level</span>
          <div className="mt-2.5 flex gap-1 rounded-2xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] p-1.5">
            {RISKS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRisk(option.value)}
                aria-pressed={risk === option.value}
                className={`flex-1 rounded-xl px-2 py-3 text-[0.85rem] font-semibold transition-colors ${
                  risk === option.value
                    ? 'bg-[var(--color-surface-high)] text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
            {RISKS.find((r) => r.value === risk)?.hint}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || view.trim().length < 3}
        className="cta mt-8 w-full py-4 text-[1rem]"
      >
        {pending ? 'Reading the book…' : 'Interpret my view'}
      </button>
      <p className="mt-3.5 text-center text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
        Nothing is signed at this step. You see the maximum loss before anything moves.
      </p>
    </div>
  );
}

function PreviewStep({
  result,
  mode,
  budget,
  pending,
  onBack,
  onExecute,
}: {
  result: InterpretResponse;
  mode: 'demo' | 'live';
  budget: number;
  pending: boolean;
  onBack: () => void;
  onExecute: () => void;
}) {
  const { quote } = result;
  const live = mode === 'live';
  const { account } = useWallet();

  return (
    <div className="space-y-4">
      {/*
       * The maximum loss is the largest thing on the screen, because it is the
       * one number the product exists to make legible. It is set in the loss
       * colour, never the accent.
       */}
      <div className="card border-[var(--color-loss)]/30 bg-[var(--color-loss)]/[0.06] p-6 sm:p-8">
        <p className="eyebrow">The most you can lose</p>
        <p className="data mt-3 flex items-baseline gap-2 text-[var(--color-loss)]">
          <span className="text-[3.2rem] leading-none font-medium sm:text-[4rem]">
            {quote.maxLoss}
          </span>
          <span className="text-[1.1rem] text-[var(--color-loss)]/70">
            {quote.collateralSymbol}
          </span>
        </p>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
          Nothing can take more than this, whatever the market does.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">The contract</p>
            <h2 className="display mt-2 text-[1.7rem] font-bold sm:text-[2rem]">{quote.label}</h2>
          </div>
          <span className="eyebrow shrink-0 rounded-full border border-[var(--color-hairline-bright)] px-3 py-1.5">
            {result.direction}
          </span>
        </div>

        <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--color-ink-muted)]">
          {result.reasoning}
        </p>
        <p className="eyebrow mt-3">
          Chosen by {result.decidedBy} · confidence {(result.confidence * 100).toFixed(0)}%
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Figure
            label="Most you can win"
            value={quote.maxGainDisplay ?? 'Unbounded'}
            tone="gain"
          />
          <Figure
            label="Breakeven"
            value={
              quote.breakeven
                ? quote.breakeven.toLocaleString('en-US', { maximumFractionDigits: 2 })
                : 'n/a'
            }
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
          <PayoffChart
            payoff={quote.payoff}
            breakeven={quote.breakeven}
            spot={quote.spot}
            strikes={quote.strikes}
            maxLossLabel={quote.maxLossDisplay}
            symbol={quote.collateralSymbol}
          />
        </div>

        <dl className="mt-6 grid gap-x-8 text-[0.85rem] sm:grid-cols-2">
          <Row label="Premium" value={quote.premiumDisplay} />
          <Row label="Contracts" value={quote.numContracts} />
          <Row label="Structure" value={quote.structure} />
          <Row label="Expiry" value={new Date(quote.expiry * 1000).toUTCString()} />
          <Row
            label="Paid in"
            value={`${quote.collateralSymbol} (${quote.collateralDecimals} decimals)`}
          />
          {quote.greeks && (
            <Row label="Implied volatility" value={`${(quote.greeks.iv * 100).toFixed(1)}%`} />
          )}
        </dl>

        {quote.notes.length > 0 && (
          <ul className="mt-5 space-y-2">
            {quote.notes.map((note) => (
              <li
                key={note}
                className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] px-4 py-3.5 text-[0.85rem] leading-relaxed text-[var(--color-ink-muted)]"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
       * A connected wallet gets its own path, above the server one. Nothing
       * about the existing flow changes: the server wallet still backs demo
       * mode, and someone with no wallet sees exactly what they saw before.
       */}
      {account && (
        <WalletTrade
          instrumentId={quote.instrumentId}
          budget={budget}
          maxLossDisplay={quote.maxLossDisplay}
        />
      )}

      {/* One primary action per screen. Live is drawn in the loss colour, not
          the accent, so the button that spends money never looks like brand. */}
      <div className="card p-6 sm:p-8">
        <button
          type="button"
          onClick={onExecute}
          disabled={pending}
          className={`w-full rounded-2xl py-4 text-[1rem] font-semibold transition-[filter,transform] ${
            live
              ? 'bg-[var(--color-loss)] text-[#1a0a0a] hover:brightness-110 active:scale-[0.985]'
              : 'cta'
          } ${pending ? 'opacity-40' : ''}`}
        >
          {pending
            ? 'Working…'
            : live
              ? `Execute for real — up to ${quote.maxLossDisplay}`
              : 'Simulate this trade — no money moves'}
        </button>

        <p className="mt-3.5 text-center text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
          {live
            ? 'This signs a transaction on Base mainnet and spends real funds.'
            : 'Demo mode. Switch to Live in the header to trade for real.'}
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full py-2 text-[0.85rem] text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink-muted)]"
        >
          Back to my view
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'gain' }) {
  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
      <p className="eyebrow">{label}</p>
      <p
        className={`data mt-2 text-[1.15rem] font-medium ${
          tone === 'gain' ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-hairline)] py-2.5">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="data text-right text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}
