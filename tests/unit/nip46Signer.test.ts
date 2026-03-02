import test from 'node:test';
import assert from 'node:assert/strict';
import { Nip46Signer } from '../../src/lib/signers/nip46Signer';

test('nip46Signer uses global bridge for pubkey and signEvent', async () => {
  (globalThis as any).__WEEDOSHI_NIP46__ = {
    getPublicKey: async () => 'f'.repeat(64),
    signEvent: async <T extends { id?: string; sig?: string }>(evt: T) => ({ ...evt, id: 'id46', sig: 'sig46' }),
  };

  const signer = new Nip46Signer();
  assert.equal(await signer.isAvailable(), true);
  assert.equal(await signer.getPublicKey(), 'f'.repeat(64));

  const signed = await signer.signEvent({ pubkey: 'f'.repeat(64) });
  assert.equal((signed as any).id, 'id46');
  assert.equal((signed as any).sig, 'sig46');
});

test('nip46Signer fails with safe error messages', async () => {
  delete (globalThis as any).__WEEDOSHI_NIP46__;
  const signer = new Nip46Signer();

  await assert.rejects(() => signer.getPublicKey(), /NIP-46 signer not available/);

  (globalThis as any).__WEEDOSHI_NIP46__ = {
    getPublicKey: async () => 'f'.repeat(64),
    signEvent: async () => {
      throw new Error('nsec1shouldnotleak');
    },
  };

  await assert.rejects(async () => {
    await signer.signEvent({ pubkey: 'f'.repeat(64) });
  }, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /NIP-46 signing failed/);
    assert.doesNotMatch(message, /nsec1/i);
    return true;
  });
});
