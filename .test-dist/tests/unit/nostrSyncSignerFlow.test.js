import test from 'node:test';
import assert from 'node:assert/strict';
import { publishPublicDiary } from '../../src/lib/nostrSync';
test('publishPublicDiary fails before publish when no signer is available', async () => {
    globalThis.window = {};
    const diary = {
        id: 'run-1',
        title: 'Run 1',
        createdAt: 1700000000,
        updatedAt: 1700000000,
        isPublic: true,
        syncStatus: 'local-only',
        items: [],
    };
    const authState = {
        isLoggedIn: true,
        isReadOnly: false,
        pubkey: 'd'.repeat(64),
        privkey: null,
        method: 'signer',
    };
    await assert.rejects(() => publishPublicDiary(diary, authState, ['wss://relay.damus.io']), /No signing method available/);
});
