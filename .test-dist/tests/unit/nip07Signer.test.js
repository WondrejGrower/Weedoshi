import test from 'node:test';
import assert from 'node:assert/strict';
import { Nip07Signer } from '../../src/lib/signers/nip07Signer';
test('nip07Signer calls window.nostr getPublicKey/signEvent', async () => {
    let signCalled = false;
    globalThis.window = {
        nostr: {
            getPublicKey: async () => 'b'.repeat(64),
            signEvent: async (evt) => {
                signCalled = true;
                return { ...evt, id: 'evt-id', sig: 'sig' };
            },
        },
    };
    const signer = new Nip07Signer();
    assert.equal(signer.isAvailable(), true);
    const pubkey = await signer.getPublicKey();
    assert.equal(pubkey, 'b'.repeat(64));
    const signed = await signer.signEvent({ pubkey: 'x' });
    assert.equal(signCalled, true);
    assert.equal(signed.id, 'evt-id');
    assert.equal(signed.sig, 'sig');
});
test('nip07Signer returns safe error when unavailable or sign fails', async () => {
    globalThis.window = {};
    const signer = new Nip07Signer();
    await assert.rejects(() => signer.getPublicKey(), /NIP-07 signer not available/);
    globalThis.window = {
        nostr: {
            getPublicKey: async () => 'c'.repeat(64),
            signEvent: async () => {
                throw new Error('nsec1shouldnotleak');
            },
        },
    };
    await assert.rejects(async () => {
        await signer.signEvent({ pubkey: 'x' });
    }, (error) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /NIP-07 signing failed/);
        assert.doesNotMatch(message, /nsec1/i);
        return true;
    });
});
