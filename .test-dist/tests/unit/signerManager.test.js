import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultSigner, ensureSignerBoundIdentity, setLocalSignerPrivkey } from '../../src/lib/signers/signerManager';
test('getDefaultSigner prefers nip07 when available', () => {
    globalThis.window = {
        nostr: {
            getPublicKey: async () => 'a'.repeat(64),
            signEvent: async (evt) => evt,
        },
    };
    const signer = getDefaultSigner();
    assert.equal(signer.kind, 'nip07');
});
test('getDefaultSigner falls back when nip07 unavailable', () => {
    globalThis.window = {};
    delete globalThis.__WEEDOSHI_NIP46__;
    setLocalSignerPrivkey(null);
    const signer = getDefaultSigner();
    assert.equal(signer.kind, 'local');
});
test('getDefaultSigner selects nip46 when bridge is available and nip07 is not', () => {
    globalThis.window = {};
    globalThis.__WEEDOSHI_NIP46__ = {
        getPublicKey: async () => 'e'.repeat(64),
        signEvent: async (evt) => evt,
    };
    setLocalSignerPrivkey(null);
    const signer = getDefaultSigner();
    assert.equal(signer.kind, 'nip46');
});
test('ensureSignerBoundIdentity validates pubkey format', async () => {
    const fakeSigner = {
        kind: 'nip46',
        isAvailable: () => true,
        getPublicKey: async () => 'not-a-pubkey',
        signEvent: async (evt) => evt,
    };
    await assert.rejects(() => ensureSignerBoundIdentity(fakeSigner), /invalid pubkey/i);
});
