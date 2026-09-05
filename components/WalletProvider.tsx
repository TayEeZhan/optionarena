'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * The visitor's own wallet, when they choose to connect one.
 *
 * Injected only, by the EIP-1193 standard, so this covers MetaMask and
 * everything else that injects the same interface — Rabby, the Coinbase
 * extension, Phantom in EVM mode. No library: the standard is a handful of
 * methods, and a connection kit would be more code than the thing itself.
 *
 * Nothing is remembered between page loads. A wallet that silently reattaches
 * is a wallet the person did not knowingly connect, and this app can spend real
 * money once one is attached.
 *
 * **The chain is checked before every transaction, not only at connect.**
 * Someone can switch networks in MetaMask halfway through a flow, and signing
 * Base calldata on another chain is how funds get lost.
 */

export const BASE_CHAIN_ID = 8453;
const BASE_HEX = '0x2105';

/** The slice of EIP-1193 this app uses. */
export interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

interface WalletContext {
  /** True once an injected provider exists. False means no wallet installed. */
  available: boolean;
  account: string | null;
  chainId: number | null;
  onBase: boolean;
  connecting: boolean;
  /** Why the last attempt failed, in words a person can act on. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Switch to Base, adding it if the wallet does not know it yet. */
  ensureBase: () => Promise<boolean>;
  /** The raw provider, for sending a transaction the user signs themselves. */
  provider: () => Eip1193 | null;
  /** The connected account's balance of one token, or null if unreadable. */
  readBalance: (token: string, decimals: number) => Promise<string | null>;
}

const Context = createContext<WalletContext | null>(null);

function injected(): Eip1193 | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

/** Turn a wallet rejection into something worth reading. */
export function readableWalletError(error: unknown): string {
  const code = (error as { code?: number })?.code;
  if (code === 4001) return 'You rejected the request in your wallet.';
  if (code === -32002)
    return 'Your wallet already has a pending request. Open it and finish there.';

  const message = (error as { message?: string })?.message;
  return message ? message : 'Your wallet refused the request.';
}

/**
 * Watch for a wallet appearing.
 *
 * This used to be a no-op, which was a real bug: `useSyncExternalStore` reads
 * the snapshot once and then only when the subscriber says to, so with nothing
 * ever signalling, the value latched at whatever it was during hydration.
 * MetaMask commonly injects `window.ethereum` *after* hydration, and the app sat
 * on "Get a wallet" forever with MetaMask installed.
 *
 * MetaMask fires `ethereum#initialized`, but not every wallet does, so a short
 * poll backs it up and stops itself as soon as a provider exists.
 */
function subscribeToWallet(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('ethereum#initialized', onChange);

  const timer = window.setInterval(() => {
    if (injected()) {
      window.clearInterval(timer);
      onChange();
    }
  }, 250);

  // Injection is an early-page-load event; a wallet that has not appeared in
  // three seconds is not going to, and an interval that runs forever is a leak.
  const stopPolling = window.setTimeout(() => window.clearInterval(timer), 3000);

  return () => {
    window.removeEventListener('ethereum#initialized', onChange);
    window.clearInterval(timer);
    window.clearTimeout(stopPolling);
  };
}

/**
 * Units to a display string, without pulling ethers into the browser bundle.
 *
 * Integer maths on the string, because a token amount that goes through a
 * JavaScript number is the bug `lib/thetanuts/decimals.ts` exists to prevent.
 */
function formatUnitsString(units: bigint, decimals: number, places = 2): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals > 0 ? digits.slice(digits.length - decimals) : '';

  const shown = fraction.slice(0, places).padEnd(places, '0');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${negative ? '-' : ''}${grouped}${places > 0 ? '.' + shown : ''}`;
}

const BALANCE_OF = '0x70a08231';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read through useSyncExternalStore rather than an effect: the server has no
  // wallet, so its snapshot is false, and the button appears after hydration
  // instead of flashing the wrong state first.
  const available = useSyncExternalStore(
    subscribeToWallet,
    () => injected() !== null,
    () => false,
  );

  // Track the wallet rather than trusting what it said when it connected.
  useEffect(() => {
    const eth = injected();
    if (!eth?.on) return;

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      setAccount(accounts && accounts.length > 0 ? accounts[0] : null);
    };
    const onChain = (...args: never[]) => {
      setChainId(Number(args[0] as unknown as string));
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);

    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = injected();
    if (!eth) {
      setError('No wallet found. Install MetaMask, then reload this page.');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const chain = (await eth.request({ method: 'eth_chainId' })) as string;
      setAccount(accounts[0] ?? null);
      setChainId(Number(chain));
    } catch (failure) {
      setError(readableWalletError(failure));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // A page cannot revoke a wallet; this forgets it on our side, which is what
    // "disconnect" honestly means here.
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  const ensureBase = useCallback(async () => {
    const eth = injected();
    if (!eth) return false;

    try {
      const current = Number((await eth.request({ method: 'eth_chainId' })) as string);
      if (current === BASE_CHAIN_ID) return true;

      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_HEX }],
      });
      setChainId(BASE_CHAIN_ID);
      return true;
    } catch (failure) {
      // 4902 means the wallet has never heard of Base. Offer to add it.
      if ((failure as { code?: number })?.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_HEX,
                chainName: 'Base',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
          setChainId(BASE_CHAIN_ID);
          return true;
        } catch (addFailure) {
          setError(readableWalletError(addFailure));
          return false;
        }
      }

      setError(readableWalletError(failure));
      return false;
    }
  }, []);

  const readBalance = useCallback(
    async (token: string, decimals: number) => {
      const eth = injected();
      if (!eth || !account) return null;

      try {
        // A plain balanceOf call. The wallet is already an RPC connection, so
        // asking it a public question needs no server round trip.
        const data = `${BALANCE_OF}${account.replace(/^0x/, '').toLowerCase().padStart(64, '0')}`;
        const raw = (await eth.request({
          method: 'eth_call',
          params: [{ to: token, data }, 'latest'],
        })) as string;

        if (!raw || raw === '0x') return null;
        return formatUnitsString(BigInt(raw), decimals);
      } catch {
        // Unreadable is not zero, and the interface has to be able to tell
        // those apart.
        return null;
      }
    },
    [account],
  );

  return (
    <Context.Provider
      value={{
        available,
        account,
        chainId,
        onBase: chainId === BASE_CHAIN_ID,
        connecting,
        error,
        connect,
        disconnect,
        ensureBase,
        provider: injected,
        readBalance,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useWallet(): WalletContext {
  const context = useContext(Context);
  if (!context) throw new Error('useWallet must be used inside WalletProvider.');
  return context;
}
