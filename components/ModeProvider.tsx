'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Demo mode versus the live path.
 *
 * Simulation is the default for new users. That is a deliberate response to a
 * thin market and it doubles as demo insurance: if a live fill hangs, the
 * simulated path still shows the product working.
 *
 * The distinction has to be unmissable. A user must never be unsure whether
 * real money is about to move, so the mode lives here, is shown in the top bar,
 * and is repeated on the button that spends money.
 */

export type Mode = 'demo' | 'live';

interface ModeContext {
  mode: Mode;
  setMode: (mode: Mode) => void;
  /** False when the server has no signing key, which pins the app to demo. */
  liveAvailable: boolean;
}

const Context = createContext<ModeContext | null>(null);

export function ModeProvider({
  liveAvailable,
  children,
}: {
  liveAvailable: boolean;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>('demo');

  return (
    <Context.Provider
      value={{
        // Never report live mode when the server cannot sign.
        mode: liveAvailable ? mode : 'demo',
        setMode,
        liveAvailable,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useMode(): ModeContext {
  const context = useContext(Context);
  if (!context) throw new Error('useMode must be used inside ModeProvider.');
  return context;
}
