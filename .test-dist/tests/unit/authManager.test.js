import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authManager } from '../../src/lib/authManager';
async function clearStorage() {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
        await AsyncStorage.multiRemove(keys);
    }
}
async function resetAuth() {
    await clearStorage();
    await authManager.logout();
    globalThis.window = {};
    delete globalThis.__WEEDOSHI_NIP46__;
}
test('authManager clears stale nsec state when secure key is unavailable', async () => {
    await resetAuth();
    await AsyncStorage.setItem('nostr_auth', JSON.stringify({ pubkey: '2'.repeat(64), method: 'nsec' }));
    await authManager.loadState();
    const stored = await AsyncStorage.getItem('nostr_auth');
    assert.equal(stored, null);
    const state = authManager.getState();
    assert.equal(state.isLoggedIn, false);
    assert.equal(state.method, null);
});
test('authManager connects NIP-46 session and persists signerKind', async () => {
    await resetAuth();
    globalThis.__WEEDOSHI_NIP46__ = {
        getPublicKey: async () => 'a'.repeat(64),
        signEvent: async (evt) => evt,
    };
    await authManager.connectNip46Session();
    const state = authManager.getState();
    assert.equal(state.isLoggedIn, true);
    assert.equal(state.method, 'signer');
    assert.equal(state.signerKind, 'nip46');
    assert.equal(state.pubkey, 'a'.repeat(64));
    assert.equal(authManager.getSignerSessionStatus(), 'nip46');
    const stored = await AsyncStorage.getItem('nostr_auth');
    assert.ok(stored);
    const data = JSON.parse(stored);
    assert.equal(data.method, 'signer');
    assert.equal(data.signerKind, 'nip46');
});
test('authManager disconnectNip46Session logs user out', async () => {
    await resetAuth();
    globalThis.__WEEDOSHI_NIP46__ = {
        getPublicKey: async () => 'b'.repeat(64),
        signEvent: async (evt) => evt,
    };
    await authManager.connectNip46Session();
    await authManager.disconnectNip46Session();
    const state = authManager.getState();
    assert.equal(state.isLoggedIn, false);
    assert.equal(state.method, null);
    assert.equal(authManager.getSignerSessionStatus(), 'none');
});
test('authManager restores signer state when preferred NIP-46 session is available', async () => {
    await resetAuth();
    globalThis.__WEEDOSHI_NIP46__ = {
        getPublicKey: async () => 'c'.repeat(64),
        signEvent: async (evt) => evt,
    };
    await AsyncStorage.setItem('nostr_auth', JSON.stringify({ pubkey: 'c'.repeat(64), method: 'signer', signerKind: 'nip46' }));
    await authManager.loadState();
    const state = authManager.getState();
    assert.equal(state.isLoggedIn, true);
    assert.equal(state.method, 'signer');
    assert.equal(state.signerKind, 'nip46');
});
test('authManager clears stale signer state when preferred NIP-46 session is unavailable', async () => {
    await resetAuth();
    await AsyncStorage.setItem('nostr_auth', JSON.stringify({ pubkey: 'd'.repeat(64), method: 'signer', signerKind: 'nip46' }));
    await authManager.loadState();
    const stored = await AsyncStorage.getItem('nostr_auth');
    assert.equal(stored, null);
    const state = authManager.getState();
    assert.equal(state.isLoggedIn, false);
    assert.equal(state.method, null);
});
test('authManager exposes unavailable pairing state when NIP-46 bridge is missing', async () => {
    await resetAuth();
    const pairing = await authManager.getNip46PairingState();
    assert.equal(pairing.phase, 'unavailable');
    assert.match(pairing.message || '', /not available/i);
});
test('authManager starts NIP-46 pairing via bridge pair method', async () => {
    await resetAuth();
    globalThis.__WEEDOSHI_NIP46__ = {
        pair: async (input) => ({
            status: 'pairing',
            pairingUri: `bunker://pair?code=${input || 'x'}`,
            code: '123456',
        }),
    };
    const pairing = await authManager.startNip46Pairing('123456');
    assert.equal(pairing.phase, 'pairing');
    assert.match(pairing.connectionUri || '', /bunker:\/\//);
    assert.equal(pairing.code, '123456');
});
test('authManager approves NIP-46 pairing via bridge finalize method', async () => {
    await resetAuth();
    globalThis.__WEEDOSHI_NIP46__ = {
        finalizePairing: async () => ({
            phase: 'paired',
            message: 'approved',
        }),
    };
    const pairing = await authManager.approveNip46Pairing();
    assert.equal(pairing.phase, 'paired');
    assert.equal(pairing.message, 'approved');
});
