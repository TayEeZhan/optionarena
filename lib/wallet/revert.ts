/**
 * Turn a contract revert into something a person can act on.
 *
 * The server path gets this for free: the SDK's `callStaticFillOrder` returns a
 * decoded error. A browser talking EIP-1193 does not — it gets a hex blob on
 * the error object and, if nobody decodes it, MetaMask's own orange "this
 * transaction is likely to fail" is the only explanation anyone sees.
 *
 * No ethers here. This module is imported by client components, and the two
 * error shapes that matter are four bytes of selector plus fixed-width words,
 * which is less code to parse by hand than an ABI decoder is to ship.
 */

/** `Panic(uint256)` — the compiler's own assertion failures. */
const PANIC = '0x4e487b71';
/** `Error(string)` — a plain `require` or `revert` with a message. */
const ERROR = '0x08c379a0';

/**
 * Solidity panic codes, in the words of the thing that went wrong.
 *
 * 0x11 is the one this project lives with: every physically settled order on
 * the Base book reverts with it inside Thetanuts' OptionBook. See
 * `docs/decisions.md` section 14.
 */
const PANICS: Record<number, string> = {
  0x01: 'an assertion inside the contract failed',
  0x11: 'an arithmetic overflow inside the contract',
  0x12: 'a division by zero inside the contract',
  0x21: 'an invalid enum value',
  0x31: 'popping from an empty array',
  0x32: 'an array index out of bounds',
  0x41: 'the contract ran out of memory',
  0x51: 'a call to an uninitialised function',
};

/** Read one 32-byte word as a number, counting from a byte offset. */
function word(data: string, byteOffset: number): number {
  const start = 2 + byteOffset * 2;
  return Number(BigInt('0x' + data.slice(start, start + 64)));
}

/**
 * Decode revert data, or null when it is not a shape we understand.
 *
 * Null is a real answer and the caller must keep it: reporting "unknown reason"
 * is honest, and inventing a cause for an undecodable revert is how someone
 * ends up debugging the wrong thing.
 */
export function decodeRevert(data: unknown): string | null {
  if (typeof data !== 'string' || !data.startsWith('0x')) return null;

  if (data.startsWith(PANIC) && data.length >= 10 + 64) {
    const code = word(data, 4);
    return PANICS[code] ?? `a panic inside the contract (code 0x${code.toString(16)})`;
  }

  if (data.startsWith(ERROR) && data.length >= 10 + 128) {
    const length = word(data, 4 + 32);
    const start = 2 + (4 + 64) * 2;
    const hex = data.slice(start, start + length * 2);

    let text = '';
    for (let i = 0; i < hex.length; i += 2) {
      text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return text.length > 0 ? text : null;
  }

  return null;
}

/**
 * Dig the revert data out of whatever the wallet or RPC threw.
 *
 * Providers disagree about where it lives — MetaMask nests it under `data`,
 * some RPCs put it on `data.originalError.data`, others hand back a plain
 * string. Walking a few levels is cheaper than being wrong about one.
 */
export function revertDataOf(error: unknown): string | null {
  const seen = new Set<unknown>();
  let node: unknown = error;

  for (let depth = 0; depth < 5 && node && typeof node === 'object'; depth++) {
    if (seen.has(node)) break;
    seen.add(node);

    const holder = node as { data?: unknown; originalError?: unknown; error?: unknown };
    if (typeof holder.data === 'string' && holder.data.startsWith('0x')) return holder.data;

    node = holder.originalError ?? holder.error ?? holder.data;
  }

  return null;
}
