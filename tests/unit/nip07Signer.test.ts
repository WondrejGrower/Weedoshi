import test from 'node:test';
import assert from 'node:assert/strict';
import { Nip07Signer } from '../../src/lib/signers/nip07Signer';

test('nip07Signer calls window.nostr getPublicKey/signEvent', async () => {
  let signCalled = false;
  (globalThis as any).window = {
    nostr: {
      getPublicKey: async () => 'b'.repeat(64),
      signEvent: async <T extends { id?: string; sig?: string }>(evt: T) => {
        signCalled = true;
        return { ...evt, id: 'evt-id', sig: 'sig' } as T;
      },
    },
  };

  const signer = new Nip07Signer();
  assert.equal(signer.isAvailable(), true);
  const pubkey = await signer.getPublicKey();
  assert.equal(pubkey, 'b'.repeat(64));

  const signed = await signer.signEvent({ pubkey: 'x' } as any);
  assert.equal(signCalled, true);
  assert.equal((signed as any).id, 'evt-id');
  assert.equal((signed as any).sig, 'sig');
});

test('nip07Signer returns safe error when unavailable or sign fails', async () => {
  (globalThis as any).window = {};
  const signer = new Nip07Signer();
  await assert.rejects(() => signer.getPublicKey(), /NIP-07 signer not available/);

  (globalThis as any).window = {
    nostr: {
      getPublicKey: async () => 'c'.repeat(64),
      signEvent: async () => {
        throw new Error('nsec1shouldnotleak');
      },
    },
  };

  await assert.rejects(async () => {
    await signer.signEvent({ pubkey: 'x' } as any);
  }, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /NIP-07 signing failed/);
    assert.doesNotMatch(message, /nsec1/i);
    return true;
  });
});
