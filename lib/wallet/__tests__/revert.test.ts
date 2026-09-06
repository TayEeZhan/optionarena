import { describe, expect, test } from 'vitest';

import { decodeRevert, revertDataOf } from '../revert';

/** Build `Panic(uint256)` revert data for one code. */
function panic(code: number): string {
  return '0x4e487b71' + code.toString(16).padStart(64, '0');
}

/** Build `Error(string)` revert data for one message. */
function errorString(message: string): string {
  const hex = [...message]
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0');

  return (
    '0x08c379a0' +
    (32).toString(16).padStart(64, '0') +
    message.length.toString(16).padStart(64, '0') +
    hex
  );
}

describe('decodeRevert', () => {
  test('names the arithmetic overflow this project lives with', () => {
    // Arrange: the exact panic Thetanuts' OptionBook raises on a physical fill.
    const data = panic(0x11);

    // Act
    const reason = decodeRevert(data);

    // Assert
    expect(reason).toBe('an arithmetic overflow inside the contract');
  });

  test('reports an unlisted panic by its code rather than guessing', () => {
    expect(decodeRevert(panic(0x99))).toBe('a panic inside the contract (code 0x99)');
  });

  test('reads the message out of a require', () => {
    expect(decodeRevert(errorString('ERC20: insufficient allowance'))).toBe(
      'ERC20: insufficient allowance',
    );
  });

  test('returns null for data it does not understand, never a guess', () => {
    expect(decodeRevert('0xdeadbeef')).toBeNull();
    expect(decodeRevert('0x')).toBeNull();
    expect(decodeRevert(undefined)).toBeNull();
    expect(decodeRevert(42)).toBeNull();
  });

  test('returns null for a truncated panic rather than reading past the end', () => {
    expect(decodeRevert('0x4e487b71' + '11')).toBeNull();
  });
});

describe('revertDataOf', () => {
  test('finds data MetaMask puts one level down', () => {
    const error = { code: -32000, message: 'execution reverted', data: panic(0x11) };
    expect(revertDataOf(error)).toBe(panic(0x11));
  });

  test('finds data nested under originalError', () => {
    const error = { message: 'call failed', originalError: { data: panic(0x12) } };
    expect(revertDataOf(error)).toBe(panic(0x12));
  });

  test('finds data nested two levels down', () => {
    const error = { error: { data: { data: panic(0x11) } } };
    expect(revertDataOf(error)).toBe(panic(0x11));
  });

  test('returns null when there is no revert data', () => {
    expect(revertDataOf({ message: 'user rejected' })).toBeNull();
    expect(revertDataOf(null)).toBeNull();
    expect(revertDataOf('boom')).toBeNull();
  });

  test('survives a cycle instead of hanging', () => {
    const error: Record<string, unknown> = { message: 'x' };
    error.originalError = error;
    expect(revertDataOf(error)).toBeNull();
  });
});
