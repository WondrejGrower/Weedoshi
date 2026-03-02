import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultSigner, ensureSignerBoundIdentity, setLocalSignerPrivkey } from '../../src/lib/signers/signerManager';

test('getDefaultSigner prefers nip07 when available', () => {
  (globalThis as any).window = {
    nostr: {
      getPublicKey: async () => 'a'.repeat(64),
      signEvent: async <T>(evt: T) => evt,
    },
  };

  const signer = getDefaultSigner();
  assert.equal(signer.kind, 'nip07');
});

test('getDefaultSigner falls back when nip07 unavailable', () => {
  (globalThis as any).window = {};
  delete (globalThis as any).__WEEDOSHI_NIP46__;
  setLocalSignerPrivkey(null);

  const signer = getDefaultSigner();
  assert.equal(signer.kind, 'local');
});

test('getDefaultSigner selects nip46 when bridge is available and nip07 is not', () => {
  (globalThis as any).window = {};
  (globalThis as any).__WEEDOSHI_NIP46__ = {
    getPublicKey: async () => 'e'.repeat(64),
    signEvent: async <T>(evt: T) => evt,
  };
  setLocalSignerPrivkey(null);

  const signer = getDefaultSigner();
  assert.equal(signer.kind, 'nip46');
});

test('ensureSignerBoundIdentity validates pubkey format', async () => {
  const fakeSigner = {
    kind: 'nip46' as const,
    isAvailable: () => true,
    getPublicKey: async () => 'not-a-pubkey',
    signEvent: async <T>(evt: T) => evt,
  };

  await assert.rejects(() => ensureSignerBoundIdentity(fakeSigner), /invalid pubkey/i);
});
