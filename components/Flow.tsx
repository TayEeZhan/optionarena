'use client';

import { useState } from 'react';
import { useMode } from './ModeProvider';
import { PayoffChart } from './PayoffChart';
import { ProofPanel } from './ProofPanel';
import type { InterpretResponse, ExecuteResponse } from '@/lib/wire';
import type { RiskLevel } from '@/lib/agent/schema';

/** The four steps, reflected in the stepper. */
const STEPS = ['Describe', 'Preview risk', 'Prove on-chain', 'Share'] as const;

const EXAMPLES = [
  'ETH drops below 2,200 this week',
  'ETH rallies hard into the weekend',
  'BTC stays flat, I want cheap downside cover',
  'I think BTC breaks 90,000 by Friday',
];

const RISKS: { value: RiskLevel; label: string; hint: string }[] = [
  { value: 'conservative', label: 'Conservative', hint: 'Closer strike, longer expiry' },
  { value: 'balanced', label: 'Balanced', hint: 'A moderate distance out' },
  { value: 'aggressive', label: 'Aggressive', hint: 'Further out, pays more if right' },
];

export function Flow() {
  const { mode } = useMode();

  const [step, setStep] = useState(0);
  const [view, setView] = useState('');
  const [budget, setBudget] = useState(5);
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
      setResult(data as InterpretResponse);
      setStep(1);
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
      setExecution(data as ExecuteResponse);
      setStep(2);
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
      <Stepper current={step} />

      {error && (
        <div className="mb-5 rounded-2xl border border-[var(--color-loss)]/40 bg-[var(--color-loss)]/8 px-5 py-4">
          <p className="eyebrow text-[var(--color-loss)]">Stopped</p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--color-ink)]">{error}</p>
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

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-7 flex items-center gap-2">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`data flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] ${
                active
                  ? 'bg-[var(--color-lime)] text-[#0a0f0b]'
                  : done
                    ? 'bg-[var(--color-surface-high)] text-[var(--color-lime)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink-faint)]'
              }`}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={`text-[0.8rem] ${
                active ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
              }`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-[var(--color-hairline-bright)]" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
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
    <div className="card p-6">
      <p className="eyebrow">Step 01</p>
      <h2 className="display mt-2 text-3xl font-semibold">What do you think happens?</h2>
      <p className="mt-2 text-[0.875rem] text-[var(--color-ink-muted)]">
        Write it in your own words. The agent turns it into a contract with a fixed maximum loss.
      </p>

      <textarea
        value={view}
        onChange={(e) => setView(e.target.value)}
        rows={3}
        placeholder="ETH drops below 2,200 before the weekend"
        className="mt-5 w-full resize-none rounded-xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-4 py-3 text-[0.95rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-lime)]/50"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setView(example)}
            className="rounded-full border border-[var(--color-hairline-bright)] px-3 py-1.5 text-[0.75rem] text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-lime)]/40 hover:text-[var(--color-ink)]"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <div>
          <label className="eyebrow" htmlFor="budget">
            Maximum spend
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] px-4 py-3">
            <input
              id="budget"
              type="number"
              min={1}
              step={1}
              value={budget}
              onChange={(e) => setBudget(Math.max(1, Number(e.target.value)))}
              className="data w-full bg-transparent text-lg outline-none"
            />
            <span className="data text-[0.8rem] text-[var(--color-ink-faint)]">USDC</span>
          </div>
          <p className="mt-2 text-[0.75rem] text-[var(--color-ink-faint)]">
            This is the most you can lose. Nothing can take more.
          </p>
        </div>

        <div>
          <span className="eyebrow">Risk level</span>
          <div className="mt-2 flex rounded-xl border border-[var(--color-hairline-bright)] bg-[var(--color-ground)] p-1">
            {RISKS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRisk(option.value)}
                title={option.hint}
                className={`flex-1 rounded-lg px-2 py-2 text-[0.75rem] font-medium transition-colors ${
                  risk === option.value
                    ? 'bg-[var(--color-surface-high)] text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.75rem] text-[var(--color-ink-faint)]">
            {RISKS.find((r) => r.value === risk)?.hint}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || view.trim().length < 3}
        className="cta mt-7 w-full py-3.5 text-[0.95rem]"
      >
        {pending ? 'Reading the book...' : 'Interpret my view'}
      </button>
      <p className="mt-3 text-center text-[0.75rem] text-[var(--color-ink-faint)]">
        Nothing is signed at this step. You see the maximum loss before anything moves.
      </p>
    </div>
  );
}

function PreviewStep({
  result,
  mode,
  pending,
  onBack,
  onExecute,
}: {
  result: InterpretResponse;
  mode: 'demo' | 'live';
  pending: boolean;
  onBack: () => void;
  onExecute: () => void;
}) {
  const { quote } = result;
  const live = mode === 'live';

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 02</p>
          <h2 className="display mt-2 text-3xl font-semibold">{quote.label}</h2>
        </div>
        <span className="eyebrow shrink-0 rounded-full border border-[var(--color-hairline-bright)] px-3 py-1">
          {result.direction}
        </span>
      </div>

      <p className="mt-4 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
        {result.reasoning}
      </p>
      <p className="eyebrow mt-2">
        Chosen by {result.decidedBy} · confidence {(result.confidence * 100).toFixed(0)}%
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Figure label="Maximum loss" value={quote.maxLossDisplay} tone="loss" emphasis />
        <Figure label="Maximum gain" value={quote.maxGainDisplay ?? 'Unbounded'} tone="gain" />
        <Figure
          label="Breakeven"
          value={quote.breakeven ? quote.breakeven.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'n/a'}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-ground)] p-4">
        <PayoffChart
          payoff={quote.payoff}
          breakeven={quote.breakeven}
          spot={quote.spot}
          strikes={quote.strikes}
          maxLossLabel={quote.maxLossDisplay}
          symbol={quote.collateralSymbol}
        />
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-2 text-[0.8rem] sm:grid-cols-2">
        <Row label="Premium" value={quote.premiumDisplay} />
        <Row label="Contracts" value={quote.numContracts} />
        <Row label="Structure" value={quote.structure} />
        <Row label="Expiry" value={new Date(quote.expiry * 1000).toUTCString()} />
        <Row label="Paid in" value={`${quote.collateralSymbol} (${quote.collateralDecimals} decimals)`} />
        {quote.greeks && <Row label="Implied volatility" value={`${(quote.greeks.iv * 100).toFixed(1)}%`} />}
      </dl>

      {quote.notes.length > 0 && (
        <ul className="mt-5 space-y-2">
          {quote.notes.map((note) => (
            <li
              key={note}
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] px-4 py-3 text-[0.8rem] leading-relaxed text-[var(--color-ink-muted)]"
            >
              {note}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onExecute}
        disabled={pending}
        className={`mt-7 w-full rounded-[0.875rem] py-3.5 text-[0.95rem] font-semibold transition-[filter] ${
          live
            ? 'bg-[var(--color-loss)] text-[#1a0a08] hover:brightness-110'
            : 'cta'
        } ${pending ? 'opacity-40' : ''}`}
      >
        {pending
          ? 'Working...'
          : live
            ? `Execute for real — spend up to ${quote.maxLossDisplay}`
            : `Simulate this trade — no money moves`}
      </button>

      <p className="mt-3 text-center text-[0.75rem] text-[var(--color-ink-faint)]">
        {live
          ? 'This signs a transaction on Base mainnet and spends real funds.'
          : 'Demo mode. Switch to Live in the top bar to trade for real.'}
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-[0.8rem] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
      >
        Back to my view
      </button>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: 'loss' | 'gain';
  emphasis?: boolean;
}) {
  const color =
    tone === 'loss'
      ? 'text-[var(--color-loss)]'
      : tone === 'gain'
        ? 'text-[var(--color-gain)]'
        : 'text-[var(--color-ink)]';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasis
          ? 'border-[var(--color-loss)]/35 bg-[var(--color-loss)]/6'
          : 'border-[var(--color-hairline)] bg-[var(--color-ground)]'
      }`}
    >
      <p className="eyebrow">{label}</p>
      <p className={`data mt-1.5 text-xl font-medium ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-hairline)] py-1.5">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="data text-right text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}
